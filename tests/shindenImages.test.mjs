import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeShindenImageUrl, shindenImageRequestUrl } from "../src/lib/shindenImages.ts";

test("accepts Shinden avatars and covers with absolute, relative, and CDN URLs", () => {
    for (const [input, expected] of [
        ["/res/avatars/42.jpg", "https://shinden.pl/res/avatars/42.jpg"],
        ["https://shinden.pl/res/avatars/42.jpg", "https://shinden.pl/res/avatars/42.jpg"],
        ["//cdn.shinden.eu/cdn1/images/42.jpg", "https://cdn.shinden.eu/cdn1/images/42.jpg"],
        ["https://cdn.shinden.eu/cdn1/images/42.jpg", "https://cdn.shinden.eu/cdn1/images/42.jpg"],
        [null, null], ["", null], ["javascript:alert(1)", null],
        ["https://shinden.pl.evil.test/avatar.jpg", null],
        ["https://user:password@shinden.pl/avatar.jpg", null],
        ["https://shinden.pl:8443/avatar.jpg", null],
    ]) assert.equal(normalizeShindenImageUrl(input), expected);
});

test("routes remote images through the authenticated image loader without changing local assets", () => {
    assert.equal(shindenImageRequestUrl("https://shinden.pl/avatar.jpg?size=32&v=2", "http://shinden-image.localhost/image", "secret"),
        "http://shinden-image.localhost/image?url=https%3A%2F%2Fshinden.pl%2Favatar.jpg%3Fsize%3D32%26v%3D2&token=secret");
    assert.equal(shindenImageRequestUrl("/hero.png", "http://shinden-image.localhost/image", "secret"), "/hero.png");
    assert.equal(shindenImageRequestUrl("https://example.com/image.jpg", "http://shinden-image.localhost/image", "secret"), "https://example.com/image.jpg");
    assert.equal(shindenImageRequestUrl("https://shinden.pl/avatar.jpg", "http://shinden-image.localhost/image", ""), "");
});
