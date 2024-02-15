"use strict";

import {
    Event,
    getEventHash,
    getPublicKey,
    nip19,
    relayInit,
    signEvent,
} from "nostr-tools";

import { Ai } from "@cloudflare/ai";

let suddendeath = require("suddendeath");
let eaw = require("eastasianwidth");
let runes = require("runes");

export interface Env {
    NULLPOGA_GA_TOKEN: string;
    NULLPOGA_VA_TOKEN: string;
    NULLPOGA_LOGINBONUS_TOKEN: string;
    NULLPOGA_NSEC: string;
    ochinchinland: KVNamespace;
    nostr_relationship: KVNamespace;
    AI: any;
}

const NULLPOGA_NPUB =
    "4e86cdbb1ed747ff40c65303d1fc463e10aecb113049b05fc4317c29e31ccaaf";

const page = `
<!doctype html>
<link href="//fonts.bunny.net/css?family=sigmar-one:400" rel="stylesheet" />
<meta charset="utf-8" />
<title>Cloudflare NullpoGa</title>
<style>
body {
  font-size: 40px;
  text-align: center;
}
h1,h2,h3 {
  font-family: 'Sigmar One', serif;
  font-style: normal;
  text-shadow: none;
  text-decoration: none;
  text-transform: none;
  letter-spacing: -0.05em;
  word-spacing: 0em;
  line-height: 1.15;
}
</style>
<body>
	<h1>ぬるぽ・ｶﾞｯ</h1>
	2023 (C) <a href="http://mattn.kaoriya.net/">mattn</a>, code is <a href="https://github.com/mattn/cloudflare-nostr-nullpoga">here</a>
</body>
`;

function notAuthenticated(_request: Request, _env: Env) {
    return new Response(
        "Not Authenticated",
        {
            status: 401,
            headers: {
                "content-type": "text/plain; charset=UTF-8",
                "accept-charset": "utf-8",
            },
        },
    );
}

function notFound(_request: Request, _env: Env) {
    return new Response(`Not found`, {
        status: 404,
    });
}

function unsupportedMethod(_request: Request, _env: Env) {
    return new Response(`Unsupported method`, {
        status: 400,
    });
}

function bearerAuthentication(request: Request, secret: string) {
    if (!request.headers.has("authorization")) {
        return false;
    }
    const authorization = request.headers.get("Authorization")!;
    const [scheme, encoded] = authorization.split(" ");
    return scheme === "Bearer" && encoded === secret;
}

function createLike(env: Env, mention: Event): Event {
    const decoded = nip19.decode(env.NULLPOGA_NSEC);
    const sk = decoded.data as string;
    const pk = getPublicKey(sk);
    const created_at = mention.created_at + 1;
    let event = {
        id: "",
        kind: 7,
        pubkey: pk,
        created_at: created_at, // Math.floor(Date.now() / 1000),
        tags: [["e", mention.id]],
        content: "🩷",
        sig: "",
    };
    event.id = getEventHash(event);
    event.sig = signEvent(event, sk);
    return event;
}

function createReplyWithTags(
    env: Env,
    mention: Event,
    message: string,
    tags: string[][],
): Event {
    const decoded = nip19.decode(env.NULLPOGA_NSEC);
    const sk = decoded.data as string;
    const pk = getPublicKey(sk);
    if (mention.pubkey === pk) throw new Error("Self reply not acceptable");
    const tt = [];
    tt.push(["e", mention.id], ["p", mention.pubkey]);
    if (mention.kind === 42) {
        for (let tag of mention.tags.filter((x: any[]) => x[0] === "e")) {
            tt.push(tag);
        }
    }
    for (let tag of tags) {
        tt.push(tag);
    }
    const created_at = mention.created_at + 1;
    let event = {
        id: "",
        kind: mention.kind,
        pubkey: pk,
        created_at: created_at, // Math.floor(Date.now() / 1000),
        tags: tt,
        content: message,
        sig: "",
    };
    event.id = getEventHash(event);
    event.sig = signEvent(event, sk);
    return event;
}

function createNoteWithTags(
    env: Env,
    mention: Event,
    message: string,
    tags: string[][],
): Event {
    const decoded = nip19.decode(env.NULLPOGA_NSEC);
    const sk = decoded.data as string;
    const pk = getPublicKey(sk);
    const tt = [];
    if (mention.kind === 42) {
        for (let tag of mention.tags.filter((x: any[]) => x[0] === "e")) {
            tt.push(tag);
        }
    }
    for (let tag of tags) {
        tt.push(tag);
    }
    const created_at = mention.created_at + 1;
    let event = {
        id: "",
        kind: mention.kind,
        pubkey: pk,
        created_at: created_at, // Math.floor(Date.now() / 1000),
        tags: tt,
        content: message,
        sig: "",
    };
    event.id = getEventHash(event);
    event.sig = signEvent(event, sk);
    return event;
}

function JSONResponse(value: any): Response {
    if (value === null) return new Response("");
    return new Response(JSON.stringify(value), {
        headers: {
            "access-control-allow-origin": "*",
            "content-type": "application/json; charset=UTF-8",
        },
    });
}

async function doPage(_request: Request, _env: Env): Promise<Response> {
    return new Response(page, {
        headers: {
            "content-type": "text/html; charset=UTF-8",
        },
    });
}

type Relation = {
    follow: Event;
    mute: Event;
    time: number;
};

async function doRelationsihp(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const pathArray = pathname.split("/");
    let relation = JSON.parse(
        (await env.nostr_relationship.get(pathArray[2])) as string,
    ) as Relation | null;
    if (pathArray.length < 3) {
        return notFound(request, env);
    }
    if (relation === null || Date.now() - relation.time > 1800000) {
        const relay = relayInit("wss://yabu.me");
        await relay.connect();
        const sk = pathArray[2].startsWith("npub1")
            ? nip19.decode(pathArray[2]).data as string
            : pathArray[2];
        const follow = await relay.get({
            kinds: [3],
            authors: [sk],
        });
        if (follow === null) {
            return notFound(request, env);
        }
        const mute = await relay.get({
            kinds: [10000],
            authors: [sk],
        });
        if (mute === null) throw "Not Found";
        relation = {
            follow: follow,
            mute: mute,
            time: Date.now(),
        };
        await env.nostr_relationship.put(pathArray[2], JSON.stringify(relation));
    }
    if (pathArray.length === 3) {
        return JSONResponse(relation);
    }
    if (pathArray.length === 5) {
        const sk = pathArray[3].startsWith("npub1")
            ? nip19.decode(pathArray[3]).data as string
            : pathArray[3];
        switch (pathArray[4]) {
            case "follow":
                const followed = relation.follow.tags.filter((x: any[]) =>
                    x[0] === "p" && x[1] === sk
                ).length > 0;
                return JSONResponse(followed);
            case "mute":
                const muted = relation.mute.tags.filter((x: any[]) =>
                    x[0] === "p" && x[1] === sk
                ).length > 0;
                return JSONResponse(muted)
        }
    }
    return notFound(request, env);
}

async function doNullpo(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_GA_TOKEN)) {
        return notAuthenticated(request, env);
    }
    const mention: Event = await request.json();
    return JSONResponse(createNoteWithTags(env, mention, "ぬるぽ", []))
}

async function doClock(_request: Request, env: Env): Promise<Response> {
    const now = new Date(
        Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000),
    );
    const hour = now.getHours();
    const message = "ぬるぽが" + (hour < 12 ? "午前" : "午後") + (hour % 12) +
        "時をお伝えします";
    const mention = {
        kind: 1,
        tags: [],
        pubkey: "",
        id: "",
        sig: "",
        content: "",
        created_at: Math.floor(Date.now() / 1000),
    } as Event;
    return JSONResponse(createNoteWithTags(env, mention, message, []))
}

async function doOchinchinLandStatus(
    _request: Request,
    env: Env,
): Promise<Response> {
    const status = (await env.ochinchinland.get("status")) as string;
    return JSONResponse({ "status": status })
}

async function doSuitou(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    return JSONResponse(createReplyWithTags(env, mention, "えらい！", []))
}

async function doIgyo(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    let tags = [[
        "emoji",
        "igyo",
        "https://i.gyazo.com/6ca054b84392b4b1bd0038d305f72b64.png",
    ]];
    return JSONResponse(createReplyWithTags(env, mention, ":igyo:", tags))
}

async function doLetterpack(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    return JSONResponse(createReplyWithTags(
        env,
        mention,
        "https://i.gyazo.com/d3d5ab0007253e060482e52e5734d402.png",
        [],
    ))
}

async function doUltrasoul(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    return JSONResponse(createReplyWithTags(env, mention, "ｳﾙﾄﾗｿｩ!", []))
}

async function doAngel(request: Request, env: Env): Promise<Response> {
    const content = "＼ｴｰﾝｼﾞｪｰﾙ!🙌／'";
    const mention: Event = await request.json();
    return JSONResponse(createNoteWithTags(env, mention, content, []))
}

async function doHi(request: Request, env: Env): Promise<Response> {
    const content = "＼ﾊｰｲ!🙌／'";
    const mention: Event = await request.json();
    return JSONResponse(createNoteWithTags(env, mention, content, []))
}

export interface bookmark {
    pattern: RegExp;
    site: string;
}

const bookmarks: bookmark[] = [
    {
        pattern: /^(おいくらsats|おいくらサッツ)$/i,
        site: "https://lokuyow.github.io/sats-rate/",
    },
    {
        pattern: /^(ぶくまびぅあ|ブックマーク)/i,
        site: "https://nostr-bookmark-viewer3.vercel.app/",
    },
    { pattern: /^(nostrends|トレンド)/i, site: "https://nostrends.vercel.app/" },
    { pattern: /^(nostrbuzzs|buzz|バズ)/i, site: "https://nostrbuzzs.deno.dev/" },
    {
        pattern:
            /^(nosli|のすり|かまくらさんのアレ|鎌倉さんのアレ|togetterみたいなやつ|togetterみたいな奴)$/i,
        site: "https://nosli.vercel.app/",
    },
    {
        pattern: /^(のぞき窓|のぞきまど)$/i,
        site: "https://relay-jp.nostr.wirednet.jp/index.html",
    },
    { pattern: /^(検索ポータル)$/i, site: "https://nostr.hoku.in/" },
    {
        pattern: /^(検索)/i,
        site:
            "https://nosey.vercel.app (鎌倉)\nhttps://search.yabu.me (いくらどん)\nhttps://showhyuga.pages.dev/utility/nos_search (ひゅうが)\nhttps://nos.today/ (だらし)",
    },
    {
        pattern: /^(nostrflu|フォローリスト.*再送信)/i,
        site: "https://heguro.github.io/nostr-following-list-util/",
    },
    { pattern: /^(nostter|のすったー)$/i, site: "https://nostter.vercel.app/" },
    { pattern: /^(rabbit)$/i, site: "https://syusui-s.github.io/rabbit/" },
    { pattern: /^(絵文字)$/i, site: "https://emojis-iota.vercel.app/" },
    {
        pattern: /^(イベントチェッカー|チェッカー)$/i,
        site: "https://koteitan.github.io/nostr-post-checker/",
    },
    {
        pattern: /^(イベント削除|削除)$/i,
        site: "https://nostr-delete.vercel.app/",
    },
    {
        pattern: /^(野須田|流速|観測所|野須田川観測所|野洲田川定点観測所)$/i,
        site: "https://nostr-hotter-site.vercel.app/",
    },
    {
        pattern: /^(のさらい|おさらい|たいむましん|かすてらふぃさんのアレ)$/i,
        site: "https://nosaray.vercel.app/",
    },
    { pattern: /^(ステータス)$/i, site: "https://nostatus.vercel.app/" },
    { pattern: /^(位置の紹介|位置表示)$/i, site: "https://mapnos.vercel.app/" },
    {
        pattern: /^(位置の更新)$/i,
        site: "https://penpenpng.github.io/imhere-nostr/",
    },
    {
        pattern: /^(MATTN)$/,
        site:
            "https://polygonscan.com/token/0xc8f48e2b873111aa820463915b3a637302171d61",
    },
    {
        pattern: /^アドベントカレンダー$/,
        site:
            "Nostr (1) https://adventar.org/calendars/8794\nNostr (2) https://adventar.org/calendars/8880\nBlueSky https://adventar.org/calendars/9443",
    },
];

async function doWhere(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    let content = "" + mention.content.replace(/どこ[?？]*$/, "").trim();
    for (const b of bookmarks) {
        if (content.match(b.pattern)) {
            return JSONResponse(createReplyWithTags(env, mention, b.site, []))
        }
    }
    const mNIP = content.match(/^NIP-?([0-9]+)/i)
    if (mNIP) {
        const url = "https://github.com/nostr-protocol/nips/blob/master/" + mNIP[1] + ".md";
        const res = await fetch(url);
        if (res.ok) {
            return JSONResponse(createReplyWithTags(env, mention, url, []))
        }
        return JSONResponse(createReplyWithTags(env, mention, "そんなん無い", []))
    }
    const mKIND = content.match(/^KIND ([0-9]+)/i)
    if (mKIND) {
        const url = "https://raw.githubusercontent.com/nostr-protocol/nips/master/README.md"
        const res = await fetch(url);
        if (res.ok) {
            const m = new Map<number, string>();
            (await res.text()).split(/\n## Event Kinds/)[1].split(/\n\n/)[0].split(/\n/).forEach(x => {
                const tok = x.split(/\|/)
                if (tok.length < 4) return
                const kind = tok[1].replace(/[`` ]/g, "") || ""
                if (kind === "") return
                const page = tok[3].match(/\(([0-9]+\.md)\)/)?.[1] || ""
                if (page === "") return
                m.set(Number(kind), page)
            })
            const kind = Number(mKIND[1])
            if (m.has(kind)) {
                const url = "https://github.com/nostr-protocol/nips/blob/master/" + m.get(kind)
                return JSONResponse(createReplyWithTags(env, mention, url, []))
            }
        }
        return JSONResponse(createReplyWithTags(env, mention, "そんなん無い", []))
    }
    return JSONResponse(null);
}

async function doGoogle(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const m = mention.content.match(/^\[(.+)\]\[検索\]$/) ||
        mention.content.match(/^検索:(.+)$/) || [];
    const contents = "https://www.google.com/search?q=" +
        encodeURIComponent((m ? m[1] : "").trim());
    return JSONResponse(createReplyWithTags(env, mention, contents, []))
}

async function doOnlyYou(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const tags = mention.tags.filter((x: any[]) => x[0] === "emoji");
    let content = mention.content.trim();
    content = content
        .replace(/^みんな(?:\s*)(.*)(?:\s*)てる[?？!！.]*$/s, "$1てないのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)でる[?？!！.]*$/s, "$1でないのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)いる[?？!！.]*$/s, "$1いないのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)てない[?？!！.]*$/s, "$1てるのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)でない[?？!！.]*$/s, "$1でるのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)てへん[?？!！.]*$/s, "$1てんのお前だけ")
        .replace(/^みんな(?:\s*)(.*)(?:\s*)でへん[?？!！.]*$/s, "$1でんのお前だけ");
    return JSONResponse(createReplyWithTags(env, mention, content, tags))
}

async function doNullpoGa(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_GA_TOKEN)) {
        return notAuthenticated(request, env);
    }
    const mention: Event = await request.json();
    let content = "" + mention.content;
    if (
        !content.match(/^ぬ[ぬるぽっー\n]+$/) || !content.match(/る/) ||
        !content.match(/ぽ/)
    ) {
        return JSONResponse(null);
    }
    content = content.replaceAll("ぬ", "ｶﾞ").replaceAll("る", "ｯ").replaceAll(
        "ぽっ",
        "ｶﾞｯ",
    ).replaceAll("ーぽ", "ｰｶﾞｯ").replaceAll("ー", "ｰ").replaceAll("っ", "ｯ")
        .replaceAll(/ｯ+/g, "ｯ").replaceAll("ぽ", "");
    return JSONResponse(createReplyWithTags(env, mention, content, []))
}

async function doTsurupoVa(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_VA_TOKEN)) {
        return notAuthenticated(request, env);
    }
    const mention: Event = await request.json();
    let content = "" + mention.content;
    if (
        !content.match(/^つ[つるぽっー\n]+$/) || !content.match(/る/) ||
        !content.match(/ぽ/)
    ) {
        return JSONResponse(null);
    }
    content = content.replaceAll("つ", "ｳﾞｧ").replaceAll("る", "ｯ").replaceAll(
        "ぽっ",
        "ｳﾞｧｯ",
    ).replaceAll("ーぽ", "ｰｳﾞｧｯ").replaceAll("ー", "ｰ").replaceAll("っ", "ｯ")
        .replaceAll(/ｯ+/g, "ｯ").replaceAll("ぽ", "");
    return JSONResponse(createReplyWithTags(env, mention, content, []))
}

async function doNattoruyarogai(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    let content = "" + mention.content;
    if (!content.match(/そうはならんやろ/)) {
        return JSONResponse(null);
    }
    return JSONResponse(createReplyWithTags(env, mention, "なっとるやろがい!!", []))
}

const pai = "🀀🀁🀂🀃🀄🀅🀆🀇🀈🀉🀊🀋🀌🀍🀎🀏🀐🀑🀒🀓🀔🀕🀖🀗🀘🀙🀚🀛🀜🀝🀞🀟🀠🀡'";
//const pai = '東南西北白発中一二三四五六七八九１２３４５６７８９①②③④⑤⑥⑦⑧⑨'

async function doMahjongPai(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const content = Array.from(pai.repeat(4))
        .map((v) => ({ v, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort).map(({ v }) => v)
        .slice(0, 14).sort().join("");
    return JSONResponse(createReplyWithTags(env, mention, content, []))
}

async function doSuddendeanth(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const tags = mention.tags.filter((x: any[]) => x[0] === "emoji");
    return JSONResponse(
        createReplyWithTags(
            env,
            mention,
            suddendeath(mention.content, true),
            tags,
        ),
    )
}

async function doLoginbonus(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_LOGINBONUS_TOKEN)) {
        return notAuthenticated(request, env);
    }
    const mention: Event = await request.json();
    return JSONResponse(createReplyWithTags(env, mention, "ありません", []))
}

async function doNagashite(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const m = mention.content.match(/流して(\s+.*)$/);
    const wave = m ? m[1].trim() : "🌊🌊🌊🌊🌊🌊🌊🌊'";
    const tags = mention.tags.filter((x: any[]) => x[0] === "emoji");
    return JSONResponse(createNoteWithTags(env, mention, (wave + "\n").repeat(12), tags))
}

let lokuyowImages: any[] = [];

async function doLokuyow(request: Request, env: Env): Promise<Response> {
    if (lokuyowImages.length === 0) {
        lokuyowImages = await fetch("https://lokuyow.github.io/images.json").then(
            (resp) => resp.json()
        );
    }
    const item = "#ロクヨウ画像\n" +
        "https://raw.githubusercontent.com/Lokuyow/Lokuyow.github.io/main/" +
        lokuyowImages[Math.floor(Math.random() * lokuyowImages.length)].src;
    const mention: Event = await request.json();
    const tags = [["t", "ロクヨウ画像"]];
    return JSONResponse(createReplyWithTags(env, mention, item, tags))
}

let shioImages: any[] = [];

async function doUpdate(_request: Request, _env: Env): Promise<Response> {
    shioImages = [];
    lokuyowImages = [];
    return JSONResponse({ "status": "OK" })
}

async function doShio(request: Request, env: Env): Promise<Response> {
    if (shioImages.length === 0) {
        shioImages = await fetch(
            "https://gist.githubusercontent.com/mattn/7bfa7895e3ee521dff9b24879081dad9/raw/shio.json",
        ).then((resp) => resp.json());
    }
    const mention: Event = await request.json();
    const arg = mention.content.split(/\s+/)[1] || "";
    const index = arg
        ? Number(arg) - 1
        : Math.floor(Math.random() * shioImages.length);
    const item = "#しお画像\n" + shioImages[index % shioImages.length].src;
    const tags = [["t", "しお画像"]];
    return JSONResponse(createReplyWithTags(env, mention, item, tags))
}

function levenshtein(a: string, b: string): number {
    const an = a ? a.length : 0;
    const bn = b ? b.length : 0;
    if (an === 0) return bn;
    if (bn === 0) return an;
    const matrix = new Array<number[]>(bn + 1);
    for (let i = 0; i <= bn; ++i) {
        let row = matrix[i] = new Array<number>(an + 1);
        row[0] = i;
    }
    const firstRow = matrix[0];
    for (let j = 1; j <= an; ++j) {
        firstRow[j] = j;
    }
    for (let i = 1; i <= bn; ++i) {
        for (let j = 1; j <= an; ++j) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1],
                    matrix[i][j - 1],
                    matrix[i - 1][j],
                ) + 1;
            }
        }
    }
    return matrix[bn][an];
}

async function doDistance(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    let content = "" + mention.content;
    let m = content.match(/^"(\S+)"と"(\S+)"の文字列距離$/);
    if (!m) m = content.match(/^「(\S+)」と「(\S+)」の文字列距離$/);
    if (!m) m = content.match(/^(\S+)\s*と\s*(\S+)\s*の文字列距離$/);
    if (!m) return JSONResponse(null);
    return JSONResponse(createReplyWithTags(env, mention, `${levenshtein(m[1], m[2])}です`, []));
}

async function doOppai(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    return JSONResponse(createLike(env, mention))
}

async function doPe(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    return JSONResponse(createNoteWithTags(env, mention, "ぺぇ〜", []))
}

async function doNya(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    let content = [" A＿＿A", "|・ㅅ・ |", "|っ　ｃ|", ""].join("\n");
    let arr = mention.content.replace(/にゃ！$/, "").split(/(:[^:]+:)/g).map(
        (x: string) => {
            if (/^(:[^:]+:)$/.test(x)) return [x];
            //return [...x.replace(/[A-Za-z0-9]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0)).replace(/[ー〜]/g, '｜')]
            return runes(
                x.replace(
                    /[A-Za-z0-9]/g,
                    (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0),
                ).replace(/[ー〜]/g, "｜"),
            );
        },
    ).flat();
    for (const c of arr) {
        if (c === "" || c === "\n" || c === "\t" || c === " ") continue;
        const isW = ["F", "W", "A", "N"].includes(eaw.eastAsianWidth(c));
        content += "|　" + (isW ? c : c + " ") + "　|\n";
    }
    content += [" U￣￣U"].join("\n");
    const tags = mention.tags.filter((x: any[]) => x[0] === "emoji");
    return JSONResponse(createReplyWithTags(env, mention, content, tags))
}

async function doGrave(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const content = mention.content.trim();
    if (!content.match(/.の墓$/)) {
        return JSONResponse(null);
    }
    let result = ["　 ＿＿_", "　 |＼ 　＼", "　 |   |￣   ｜", ""].join("\n");

    let arr = content.replace(/の墓$/, "").split(/(:[^:]+:)/g).map(
        (x: string) => {
            if (/^(:[^:]+:)$/.test(x)) return [x];
            //return [...x.replace(/[A-Za-z0-9]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0)).replace(/[ー〜]/g, '｜')]
            return runes(
                x.replace(
                    /[A-Za-z0-9]/g,
                    (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0),
                ).replace(/[ー〜]/g, "｜"),
            );
        },
    ).flat();
    for (const c of arr) {
        if (c === "" || c === "\n" || c === "\t" || c === " ") continue;
        const isW = ["F", "W", "A", "N"].includes(eaw.eastAsianWidth(c));
        result += "　 |   |  " + (isW ? c : c + " ") + " ｜\n";
    }
    result += [
        "　 |   |  の ｜",
        " ＿|   |  墓 ｜",
        "|＼＼|＿＿亅＼",
        " ＼匚二 ˘ω˘  二]",
    ].join("\n");
    const tags = mention.tags.filter((x: any[]) => x[0] === "emoji");
    return JSONResponse(createReplyWithTags(env, mention, result, tags))
}

async function doFumofumo(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const content = "https://image.nostr.build/f8b39a30c03aa0fafdd74f7f6be3956696f4546ced43c28b0a6103c6ff3a3478.jpg"
    return JSONResponse(createReplyWithTags(env, mention, content, []))
}

async function doOchinchinLand(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const tags = mention.tags.filter((x: any[]) => x[0] === "emoji");

    let content = "";
    if (mention.content.match(/[?？]$/)) {
        const status = (await env.ochinchinland.get("status")) as string;
        content = status === "open" ? "開園中" : "閉園中";
    } else if (mention.content.match(/開閉[!！]*$/)) {
        await env.ochinchinland.put("status", "close");
        content =
            "https://cdn.nostr.build/i/f6103329b41603af2b36ec0131d27dd39d28ca1ddeb0041cd2839e5954563a92.jpg";
    } else if (mention.content.match(/閉園[!！]*$/)) {
        await env.ochinchinland.put("status", "close");
        content =
            "https://cdn.nostr.build/i/4a7963a07bdac34b1408b871548d3a06527af359ad5a9f080d3c2031f6e582fe.jpg";
    } else if (mention.content.match(/開園[!！]*$/)) {
        await env.ochinchinland.put("status", "open");
        content =
            "https://cdn.nostr.build/i/662dab3ac355c5b2e8682f10eef4102342599bf8f77b52e9c7a7a52153398bfd.jpg";
    } else {
        return JSONResponse(null);
    }
    return JSONResponse(createReplyWithTags(env, mention, content, tags))
}

async function doWakaru(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const tags = mention.tags.filter((x: any[]) => x[0] === "emoji");
    const content = mention.content.trim().match(/^[わ分]かる[!！]*$/)
        ? "https://cdn.nostr.build/i/f795a1ba2802c5b397cb538d0068da2deb6e7510d8cfff877e5561a15d55199b.jpg"
        : "https://cdn.nostr.build/i/fd99d078ba96f85b5e3f754e1aeef5f42dbf3312b5a345c5f3ea6405ce2980a7.jpg";
    return JSONResponse(createReplyWithTags(env, mention, content, tags))
}

const hakatano = new Map([
    ["裸に", "しろ"],
    ["はだかに", "しろ"],
    ["たかなわ", "ゲートウェイ"],
    ["たかだの", "ばば"],
    ["さかたと", "しお"],
    ["かけいと", "しお"],
    ["もりもと", "れお"],
    ["とみーず", "まさ"],
    ["おかもと", "まよ"],
    ["まつもと", "いよ"],
    ["みわあき", "ひろ"],
    ["あたたた", "たた"],
    ["はやしら", "いす"],
    ["あるかの", "いど"],
    ["はがたを", "みろ"],
    ["はかたの", "しお"],
]);

async function doHakatano(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const tags = mention.tags.filter((x: any[]) => x[0] === "emoji");
    const content = mention.content.replace(/っ/g, "").replace(/[!！]/g, "")
        .trim();
    for (const [k, v] of hakatano) {
        if (content === k) {
            return JSONResponse(createReplyWithTags(env, mention, v, tags))
        }
    }
    return JSONResponse(null);
}

async function doSUUMO(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const content =
        "🌚ダン💥ダン💥ダン💥シャーン🎶ぽわ🌝ぽわ🌚ぽわ🌝ぽわ🌚ぽわ🌝ぽわ🌚ぽ〜〜〜わ⤴ぽわ🌚ぽわ🌝ぽわ🌚ぽわ🌝ぽわ🌚ぽわ🌝ぽ～～～わ⤵🌞'";
    return JSONResponse(createNoteWithTags(env, mention, content, []))
}

async function doCAT(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    if (mention.pubkey === NULLPOGA_NPUB) return JSONResponse(null);
    let res = await fetch("https://api.thecatapi.com/v1/images/search");
    const images: { [name: string]: any } = await res.json();
    const tags = [["t", "ぬっこ画像"]];
    return JSONResponse(createReplyWithTags(env, mention, `#ぬっこ画像\n${images[0].url}`, tags))
}

async function doDOG(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    if (mention.pubkey === NULLPOGA_NPUB) return JSONResponse(null);
    let res = await fetch("https://api.thedogapi.com/v1/images/search");
    const images: { [name: string]: any } = await res.json();
    const tags = [["t", "いっぬ画像"]];
    return JSONResponse(createReplyWithTags(env, mention, `#いっぬ画像\n${images[0].url}`, tags))
}

async function doTranslate(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const m = mention.content.match(/(和英|英和)\s+(.+)$/) || [];
    const content = m ? m[2] : "";
    const ai = new Ai(env.AI);
    const inputs = {
        text: content,
        source_lang: "en",
        target_lang: "ja",
    };
    switch (m[1]) {
        case "英和":
            inputs.source_lang = "en";
            inputs.target_lang = "ja";
            break;
        case "和英":
            inputs.source_lang = "ja";
            inputs.target_lang = "en";
            break;
    }
    const response = await ai.run("@cf/meta/m2m100-1.2b", inputs);
    const tags = mention.tags.filter((x: any[]) => x[0] === "emoji");
    return JSONResponse(createReplyWithTags(env, mention, response.translated_text, tags))
}

async function doMetadata(request: Request, env: Env): Promise<Response> {
    const metadata: Event = await request.json();
    const tags = metadata.tags.filter((x: any[]) => x[0] === "emoji");
    const profile: { [name: string]: any } = JSON.parse(metadata.content);
    const content = `${profile["display_name"].trim()
        } さんがプロフィールを更新しました`;
    metadata.kind = 1;
    return JSONResponse(createNoteWithTags(env, metadata, content, tags))
}

export interface Rate {
    pair: string;
    time: string;
    rate: string;
}

async function doBtcHow(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const url = "https://coincheck.com/ja/exchange/rates/search?pair=btc_jpy&time=" + new Date().toISOString()
    const res = await fetch(url);
    if (res.ok) {
        return JSONResponse(createReplyWithTags(env, mention, `現在のビットコイン日本円建てで ${(await res.json() as Rate).rate} 円です`, []))
    }
    return JSONResponse(createNoteWithTags(env, mention, "", []))
}

export interface Quotes {
    quotes: {
        high: string;
        open: string;
        bid: string;
        currencyPairCode: string;
        ask: string;
        low: string;
    }[]
}

async function doJpyHow(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    const url = "https://www.gaitameonline.com/rateaj/getrate"
    const res = await fetch(url);
    if (res.ok) {
        const usdjpy: string = (await res.json() as Quotes).quotes.filter((x) => x?.currencyPairCode === "USDJPY")[0].bid || '?';
        return JSONResponse(createReplyWithTags(env, mention, `現在の円相場は1ドル ${usdjpy} 円です`, []))
    }
    return JSONResponse(createNoteWithTags(env, mention, "", []))
}

async function doSleeply(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    return JSONResponse(createReplyWithTags(env, mention, "(`･д･⊂彡☆))Д´)) ﾊﾟｧﾝ", []))
}

async function doHit(request: Request, env: Env): Promise<Response> {
    const mention: Event = await request.json();
    return JSONResponse(createNoteWithTags(env, mention, "(`･д･⊂彡☆))Д´)) ﾊﾟｧﾝ", []));
}

export default {
    async fetch(
        request: Request,
        env: Env,
    ): Promise<Response> {
        const { protocol, pathname } = new URL(request.url);
        const pathArray = pathname.split("/");

        if (
            "https:" !== protocol ||
            "https" !== request.headers.get("x-forwarded-proto")
        ) {
            throw new Error("Please use a HTTPS connection.");
        }

        console.log(`${request.method}: ${request.url} `);

        if (request.method === "GET") {
            switch (pathArray[1]) {
                case "nullpo":
                    return doNullpo(request, env);
                case "ochinchinland":
                    return doOchinchinLandStatus(request, env);
                case "clock":
                    return doClock(request, env);
                case "update":
                    return doUpdate(request, env);
                case "relationship":
                    return doRelationsihp(request, env);
                case "":
                    return doPage(request, env);
            }
            return notFound(request, env);
        }
        if (request.method === "POST") {
            switch (pathArray[1]) {
                case "loginbonus":
                    return doLoginbonus(request, env);
                case "lokuyow":
                    return doLokuyow(request, env);
                case "shio":
                    return doShio(request, env);
                case "tsurupo":
                    return doTsurupoVa(request, env);
                case "nagashite":
                    return doNagashite(request, env);
                case "nattoruyarogai":
                    return doNattoruyarogai(request, env);
                case "suddendeath":
                    return doSuddendeanth(request, env);
                case "mahjongpai":
                    return doMahjongPai(request, env);
                case "onlyyou":
                    return doOnlyYou(request, env);
                case "suitou":
                    return doSuitou(request, env);
                case "igyo":
                    return doIgyo(request, env);
                case "letterpack":
                    return doLetterpack(request, env);
                case "ultrasoul":
                    return doUltrasoul(request, env);
                case "hi":
                    return doHi(request, env);
                case "angel":
                    return doAngel(request, env);
                case "where":
                    return doWhere(request, env);
                case "google":
                    return doGoogle(request, env);
                case "distance":
                    return doDistance(request, env);
                case "oppai":
                    return doOppai(request, env);
                case "pe":
                    return doPe(request, env);
                case "nya":
                    return doNya(request, env);
                case "grave":
                    return doGrave(request, env);
                case "ochinchinland":
                    return doOchinchinLand(request, env);
                case "fumofumo":
                    return doFumofumo(request, env);
                case "wakaru":
                    return doWakaru(request, env);
                case "hakatano":
                    return doHakatano(request, env);
                case "suumo":
                    return doSUUMO(request, env);
                case "cat":
                    return doCAT(request, env);
                case "dog":
                    return doDOG(request, env);
                case "nemui":
                    return doSleeply(request, env);
                case "hit":
                    return doHit(request, env);
                case "translate":
                    return doTranslate(request, env);
                case "metadata":
                    return doMetadata(request, env);
                case "btchow":
                    return doBtcHow(request, env);
                case "jpyhow":
                    return doJpyHow(request, env);
                case "":
                    return doNullpoGa(request, env);
            }
            return notFound(request, env);
        }

        return unsupportedMethod(request, env);
    },
};
