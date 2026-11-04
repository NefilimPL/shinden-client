import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function sessionHelpers() {
    const source=readFileSync("src/lib/librarySession.ts","utf8");
    const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.CommonJS}}).outputText;
    const exports={};
    new Function("exports",js)(exports);
    return exports;
}

test("profile changes clear private tabs and progress even when the nick is the same",()=>{
    const {profileChanged,resetProfileContext}=sessionHelpers();
    assert.equal(profileChanged("guest","user:7"),true);
    assert.equal(profileChanged("user:7","user:7"),false);
    const params={animeName:"Private",seriesUrl:"private",titleId:42,episodeProgress:[{watched:true}],currentEpisodeIndex:2,playerId:"x",playersUrl:"x",animeWatchStatus:"completed",animeIsFavourite:1,animeTotalEpisodes:12};
    let reset=0;
    resetProfileContext(params,()=>reset++);
    assert.equal(params.titleId,null);
    assert.deepEqual(params.episodeProgress,[]);
    assert.equal(params.animeName,"");
    assert.equal(reset,1);
});

test("startup does not start background scans or query the remote session",()=>{
    const layout=readFileSync("src/routes/+layout.svelte","utf8");
    assert.doesNotMatch(layout,/startWatchlistBackgroundRefresh\(/);
    assert.doesNotMatch(layout,/plannedEpisodeNotificationStore\.start\(/);
    const account=readFileSync("src/lib/AccountButton.svelte","utf8");
    assert.doesNotMatch(account,/getUserData|onMount/);
});

test("Guest can open the library and edit locally without logging in",()=>{
    const list=readFileSync("src/routes/account/lists/+page.svelte","utf8");
    assert.doesNotMatch(list,/goto\("\/account"\)/);
    const episodes=readFileSync("src/routes/episodes/+page.svelte","utf8");
    assert.match(episodes,/canEdit=\{true\}/);
});

function invocation() {
    const source=readFileSync("src/lib/shindenInvoke.ts","utf8");
    const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.CommonJS}}).outputText;
    let epoch=0; let resolve;
    const pending=new Promise(r=>resolve=r);
    const exports={};
    const require=(id)=>id.includes("core") ? {invoke:()=>pending} : id.includes("browserVerification") ? {invokeWithVerification:run=>run(),requireBrowserVerification:()=>{}} : {currentProfileEpoch:()=>epoch};
    new Function("require","exports",js)(require,exports);
    return {invoke:exports.invoke,changeProfile:()=>epoch++,resolve:()=>resolve("value")};
}

test("startup profile initialization does not reject the image proxy token",async()=>{
    const ipc=invocation(); const result=ipc.invoke("get_image_proxy_token");
    ipc.changeProfile();ipc.resolve();
    assert.equal(await result,"value");
});

test("a late profile snapshot cannot restore the previous profile",async()=>{
    const ipc=invocation(); const result=ipc.invoke("get_library_state");
    ipc.changeProfile();ipc.resolve();
    await assert.rejects(result,/profil/);
});
