import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function loginPage(options = {}) {
  const source = readFileSync("src/routes/account/+page.svelte", "utf8").split("</script>")[0].replace(/^[\s\S]*?<script[^>]*>/, "");
  const ast = ts.createSourceFile("account.ts", source, ts.ScriptTarget.Latest, true);
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ["openLogin", "handleLogin"].includes(node.name?.text));
  const js = ts.transpileModule(functions.map(node => node.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText;
  const calls = [];
  const states = { loadingState: "ok" };
  const page = new Function("invoke", "getUserData", "globalStates", `
    let loginOpened=false, loginBusy=false, loginError="";
    const LoadingState={LOADING:"loading",OK:"ok",ERROR:"error"}; const LogLevel={}; const log=()=>{};
    ${js}
    return {openLogin,handleLogin,state:()=>({loginOpened,loginBusy,loginError})};
  `)(async command => { calls.push(command); if (options.failCommand === command) throw new Error("Login pending"); }, async () => options.authenticated ?? true, states);
  return { ...page, calls, states };
}

test("login opens Shinden then confirms the browser session", async () => {
  const page = loginPage();
  await page.openLogin();
  assert.equal(page.state().loginOpened, true);
  await page.handleLogin();
  assert.deepEqual(page.calls, ["open_shinden_login", "complete_shinden_login"]);
  assert.equal(page.states.loadingState, "ok");
  assert.equal(page.state().loginBusy, false);
});

test("an incomplete browser login stays retryable and displays its error", async () => {
  const page = loginPage({ failCommand: "complete_shinden_login" });
  await page.openLogin(); await page.handleLogin();
  assert.equal(page.states.loadingState, "error");
  assert.match(page.state().loginError, /Login pending/);
  assert.equal(page.state().loginOpened, true);
  assert.equal(page.state().loginBusy, false);
});
