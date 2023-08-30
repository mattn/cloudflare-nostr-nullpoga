'use strict'

import {
    nip19,
    getPublicKey,
    getEventHash,
    signEvent
} from 'nostr-tools'

const suddendeath = require('suddendeath')
var eaw = require('eastasianwidth')
var runes = require('runes')

export interface Env {
    NULLPOGA_GA_TOKEN: string
    NULLPOGA_VA_TOKEN: string
    NULLPOGA_LOGINBONUS_TOKEN: string
    NULLPOGA_NSEC: string
}

const NULLPOGA_NPUB: string = '4e86cdbb1ed747ff40c65303d1fc463e10aecb113049b05fc4317c29e31ccaaf'

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
`

function notAuthenticated(_request: Request, _env: Env) {
    return new Response(
        'Not Authenticated',
        {
            status: 401,
            headers: {
                'content-type': 'text/plain; charset=UTF-8',
                'accept-charset': 'utf-8',
            },
        },
    )
}

function notFound(_request: Request, _env: Env) {
    return new Response(`Not found`, {
        status: 404,
    })
}

function unsupportedMethod(_request: Request, _env: Env) {
    return new Response(`Unsupported method`, {
        status: 400,
    })
}

function bearerAuthentication(request: Request, secret: string) {
    if (!request.headers.has('authorization')) {
        return false
    }
    const authorization = request.headers.get('Authorization')!
    const [scheme, encoded] = authorization.split(' ')
    return scheme === 'Bearer' && encoded === secret
}

function createLike(env: Env, mention: { [name: string]: any }): { [name: string]: any } {
    const decoded = nip19.decode(env.NULLPOGA_NSEC)
    const sk = decoded.data as string
    const pk = getPublicKey(sk)
    let event = {
        id: '',
        kind: 7,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', mention.id]],
        content: '❤',
        sig: '',
    }
    event.id = getEventHash(event)
    event.sig = signEvent(event, sk)
    return event
}

function createReplyWithTags(env: Env, mention: { [name: string]: any }, message: string, tags: string[][]): { [name: string]: any } {
    const decoded = nip19.decode(env.NULLPOGA_NSEC)
    const sk = decoded.data as string
    const pk = getPublicKey(sk)
    if (mention.pubkey == pk) throw new Error('Self reply not acceptable')
    const tt = []
    tt.push(['e', mention.id], ['p', mention.pubkey])
    if (mention.kind == 49) {
        for (let tag of mention.tags.filter((x: any[]) => x[0] === 'e')) {
            tt.push(tag)
        }
    }
    for (let tag of tags) {
        tt.push(tag)
    }
    let event = {
        id: '',
        kind: mention.kind,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: tt,
        content: message,
        sig: '',
    }
    event.id = getEventHash(event)
    event.sig = signEvent(event, sk)
    return event
}

function createNoteWithTags(env: Env, mention: { [name: string]: any }, message: string, tags: string[][]): { [name: string]: any } {
    const decoded = nip19.decode(env.NULLPOGA_NSEC)
    const sk = decoded.data as string
    const pk = getPublicKey(sk)
    const tt = []
    for (let tag of mention.tags.filter((x: any[]) => x[0] === 'e')) {
        tt.push(tag)
    }
    for (let tag of tags) {
        tt.push(tag)
    }
    let event = {
        id: '',
        kind: mention.kind,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: tt,
        content: message,
        sig: '',
    }
    event.id = getEventHash(event)
    event.sig = signEvent(event, sk)
    return event
}

async function doPage(_request: Request, _env: Env): Promise<Response> {
    return new Response(page, {
        headers: {
            'content-type': 'text/html; charset=UTF-8',
        },
    })
}

async function doNullpo(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_GA_TOKEN)) {
        return notAuthenticated(request, env)
    }
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createNoteWithTags(env, mention, 'ぬるぽ', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doClock(_request: Request, env: Env): Promise<Response> {
    const now = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000))
    const hour = now.getHours()
    const message = 'ぬるぽが' + (hour < 12 ? '午前' : '午後') + (hour % 12) + '時をお伝えします'
    return new Response(JSON.stringify(createNoteWithTags(env, { kind: 1, tags: [] }, message, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doOchinchinLandStatus(_request: Request, env: Env): Promise<Response> {
    const status = (await env.ochinchinland.get('status')) as string
    return new Response(JSON.stringify({ "status": status }), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
            'access-control-allow-origin': '*',
        },
    })
}

async function doSuitou(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createReplyWithTags(env, mention, 'えらい！', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doIgyo(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    let tags = [['emoji', 'igyo', 'https://i.gyazo.com/6ca054b84392b4b1bd0038d305f72b64.png']]
    return new Response(JSON.stringify(createReplyWithTags(env, mention, ':igyo:', tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doLetterpack(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createReplyWithTags(env, mention, 'https://i.gyazo.com/d3d5ab0007253e060482e52e5734d402.png', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doUltrasoul(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createReplyWithTags(env, mention, 'ｳﾙﾄﾗｿｩ!', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doHi(request: Request, env: Env): Promise<Response> {
    const content = Math.floor(Math.random() * 1000) === 0 ? 'なんやねん' : '＼ﾊｰｲ!🙌／'
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createNoteWithTags(env, mention, content, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

export interface bookmark {
    pattern: RegExp;
    site: string;
}

const bookmarks: bookmark[] = [
    { pattern: /^おいくらsats$|^おいくらサッツ$/i, site: 'https://lokuyow.github.io/sats-rate/' },
    { pattern: /^ぶくまびぅあ$|ブックマーク/i, site: 'https://nostr-bookmark-viewer3.vercel.app/' },
    { pattern: /^nostrends$|トレンド/i, site: 'https://nostrends.vercel.app/' },
    { pattern: /^nostrbuzzs$|buzz/i, site: 'https://nostrbuzzs.deno.dev/' },
    { pattern: /^nosli$|^かまくらさんのアレ$|^鎌倉さんのアレ$|togetterみたいな/i, site: 'https://nosli.vercel.app/' },
    { pattern: /^のぞき窓$|^のぞきまど$/i, site: 'https://relay-jp.nostr.wirednet.jp/index.html' },
    { pattern: /^検索ポータル$/i, site: 'https://nostr.hoku.in/' },
    { pattern: /^検索$/i, site: 'https://nosey.vercel.app (鎌倉)\nhttps://search.yabu.me (いくらどん)\nhttps://showhyuga.pages.dev/utility/nos_search (ひゅうが)' },
    { pattern: /^nostrflu$|フォローリスト.*再送信/i, site: 'https://heguro.github.io/nostr-following-list-util/' },
    { pattern: /^nostter$|^のすったー$/i, site: 'https://nostter.vercel.app/' },
    { pattern: /^rabbit$/i, site: 'https://syusui-s.github.io/rabbit/' },
    { pattern: /^絵文字パック$|絵文字/i, site: 'https://emojis-iota.vercel.app/' },
    { pattern: /^イベントチェッカー$|チェッカー/i, site: 'https://koteitan.github.io/nostr-post-checker/' },
    { pattern: /^イベント削除$|削除/i, site: 'https://nostr-delete.vercel.app/' },
    { pattern: /^流速$|^観測所$|^野須田川観測所$|^野洲田川定点観測所$/i, site: 'https://nostr-hotter-site.vercel.app/' },
    { pattern: /^のさらい$|^おさらい$|^たいむましん$|^かすてらふぃさんのアレ$/i, site: 'https://nosaray.vercel.app/' },
]

async function doWhere(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    let content = '' + mention.content.replace(/どこ[?？]*$/, '').trim()
    for (const b of bookmarks) {
        if (content.match(b.pattern)) {
            return new Response(JSON.stringify(createReplyWithTags(env, mention, b.site, [])), {
                headers: {
                    'content-type': 'application/json; charset=UTF-8',
                },
            })
        }
    }
    return new Response('')
}

async function doOnlyYou(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const tags = mention.tags.filter((x: any[]) => x[0] === 'emoji')
    let content = '' + mention.content
    content = content
        .replace(/^みんな(?:\s*)(.*)(?:\s*)てる[?？!！.]*$/s, '$1てないのお前だけ')
        .replace(/^みんな(?:\s*)(.*)(?:\s*)でる[?？!！.]*$/s, '$1でないのお前だけ')
        .replace(/^みんな(?:\s*)(.*)(?:\s*)いる[?？!！.]*$/s, '$1いないのお前だけ')
        .replace(/^みんな(?:\s*)(.*)(?:\s*)てない[?？!！.]*$/s, '$1てるのお前だけ')
        .replace(/^みんな(?:\s*)(.*)(?:\s*)でない[?？!！.]*$/s, '$1でるのお前だけ')
        .replace(/^みんな(?:\s*)(.*)(?:\s*)てへん[?？!！.]*$/s, '$1てんのお前だけ')
        .replace(/^みんな(?:\s*)(.*)(?:\s*)でへん[?？!！.]*$/s, '$1でんのお前だけ')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doNullpoGa(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_GA_TOKEN)) {
        return notAuthenticated(request, env)
    }
    const mention: { [name: string]: any } = await request.json()
    let content = '' + mention.content
    if (!content.match(/^ぬ[ぬるぽっー\n]+$/) || !content.match(/る/) || !content.match(/ぽ/)) {
        return new Response('')
    }
    content = content.replaceAll('ぬ', 'ｶﾞ').replaceAll('る', 'ｯ').replaceAll('ぽっ', 'ｶﾞｯ').replaceAll('ーぽ', 'ｰｶﾞｯ').replaceAll('ー', 'ｰ').replaceAll('っ', 'ｯ').replaceAll(/ｯ+/g, 'ｯ').replaceAll('ぽ', '')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doTsurupoVa(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_VA_TOKEN)) {
        return notAuthenticated(request, env)
    }
    const mention: { [name: string]: any } = await request.json()
    let content = '' + mention.content
    if (!content.match(/^つ[つるぽっー\n]+$/) || !content.match(/る/) || !content.match(/ぽ/)) {
        return new Response('')
    }
    content = content.replaceAll('つ', 'ｳﾞｧ').replaceAll('る', 'ｯ').replaceAll('ぽっ', 'ｳﾞｧｯ').replaceAll('ーぽ', 'ｰｳﾞｧｯ').replaceAll('ー', 'ｰ').replaceAll('っ', 'ｯ').replaceAll(/ｯ+/g, 'ｯ').replaceAll('ぽ', '')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doNattoruyarogai(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    let content = '' + mention.content
    if (!content.match(/そうはならんやろ/)) {
        return new Response('')
    }
    return new Response(JSON.stringify(createReplyWithTags(env, mention, 'なっとるやろがい!!', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

const pai = '🀀🀁🀂🀃🀄🀅🀆🀇🀈🀉🀊🀋🀌🀍🀎🀏🀐🀑🀒🀓🀔🀕🀖🀗🀘🀙🀚🀛🀜🀝🀞🀟🀠🀡'
//const pai = '東南西北白発中一二三四五六七八九１２３４５６７８９①②③④⑤⑥⑦⑧⑨'

async function doMahjongPai(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const content = Array.from(pai.repeat(4))
        .map(v => ({ v, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort).map(({ v }) => v)
        .slice(0, 14).sort().join('')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
};

async function doSuddendeanth(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const tags = mention.tags.filter((x: any[]) => x[0] === 'emoji')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, suddendeath(mention.content, true), tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
};

async function doLoginbonus(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env.NULLPOGA_LOGINBONUS_TOKEN)) {
        return notAuthenticated(request, env)
    }
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createReplyWithTags(env, mention, 'ありません', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doNagashite(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const m = mention.content.match(/流して(\s+.*)$/)
    const wave = m ? m[1].trim() : '🌊🌊🌊🌊🌊🌊🌊🌊'
    const tags = mention.tags.filter((x: any[]) => x[0] === 'emoji')
    return new Response(JSON.stringify(createNoteWithTags(env, mention, (wave + '\n').repeat(12), tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doLokuyow(request: Request, env: Env): Promise<Response> {
    const icons = [
        'hutu.png',
        'hutu-2.png',
        'hutu-up.png',
        'huhe.png',
        'nita.png',
        'maji.png',
        'bero.png',
        'bero-ai.png',
        'basu.png',
        'kowa.png',
        'kowa2.png',
        'kowa2-ai.png',
        'nita0.png',
        'ike2.png',
        'tiku.png',
        'tiku2.png',
        'mono.png',
        'note13kmrhvkpnqk3tkg4z4x7527aqejqg90vk8hwe38khmd9hn29lcwsr5qxaj.jpg',
        'note18aqm9p750934wyswmhfrdu93tnexrn6s62ser2fdlgs3xw7pc6csegutl2.jpg',
        'note1x4sau4fqg7yg5l639x3d9yahhczmhvzgg6sc9adzttc2uqer4faqvx5p7q.jpg',
        'note14x0c3vwz47ht4vnuvd0wxc5l8az2k09z4hx2hmw4zcgwz26nd9lsrr6f68.jpg',
        'note10z20nh6k3cawg6d2alqdytqct5rud897l0eplv930zkzpt4k6zqs96lr8q.jpg',
        'note1myxhqt5p3sc477h3fw7qfjgv37rx05cuj5yfj0y7u59yjszjjxgsczz76w.jpg',
        'note1pju99k0jwhw3dftr4a2fk0kj5yaackklgaxx0tr9tstthnzkygwqyufrqg.jpg',
    ]
    const item = '#ロクヨウ画像\n' + 'https://raw.githubusercontent.com/Lokuyow/Lokuyow.github.io/main/icon/' + icons[Math.floor(Math.random() * icons.length)]
    const mention: { [name: string]: any } = await request.json()
    const tags = [['t', 'ロクヨウ画像']]
    return new Response(JSON.stringify(createReplyWithTags(env, mention, item, tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
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
                    matrix[i - 1][j]
                ) + 1;
            }
        }
    }
    return matrix[bn][an];
}

async function doDistance(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    let content = '' + mention.content;
    let m = content.match(/^"(\S+)"と"(\S+)"の文字列距離$/)
    if (!m) m = content.match(/^「(\S+)」と「(\S+)」の文字列距離$/)
    if (!m) m = content.match(/^(\S+)\s*と\s*(\S+)\s*の文字列距離$/)
    if (!m) return new Response('')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, `${levenshtein(m[1], m[2])}です`, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doLike(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createLike(env, mention)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doPe(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    return new Response(JSON.stringify(createNoteWithTags(env, mention, 'ぺぇ〜', [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doNya(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    let content = [' A＿＿A', '|・ㅅ・ |', '|っ　ｃ|', ''].join('\n')
    let arr = mention.content.replace(/にゃ！$/, '').split(/(:[^:]+:)/g).map((x: string) => {
        if (/^(:[^:]+:)$/.test(x)) return [x]
        //return [...x.replace(/[A-Za-z0-9]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0)).replace(/[ー〜]/g, '｜')]
        return runes(x.replace(/[A-Za-z0-9]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0xFEE0)).replace(/[ー〜]/g, '｜'))
    }).flat()
    for (const c of arr) {
        if (c == '' || c === '\n' || c === '\t' || c === ' ') continue
        const isW = ['F', 'W', 'A', 'N'].includes(eaw.eastAsianWidth(c))
        content += '|　' + (isW ? c : c + ' ') + '　|\n'
    }
    content += [' U￣￣U'].join('\n')
    const tags = mention.tags.filter((x: any[]) => x[0] === 'emoji')
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doOchinchinLand(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const tags = mention.tags.filter((x: any[]) => x[0] === 'emoji')

    let content = ''
    if (mention.content.match(/[?？]$/)) {
        const status = (await env.ochinchinland.get('status')) as string
        content = status === 'open' ? '開園中' : '閉園中'
    } else if (mention.content.match(/開閉[!！]*$/)) {
        await env.ochinchinland.put('status', 'close')
        content = 'https://cdn.nostr.build/i/f6103329b41603af2b36ec0131d27dd39d28ca1ddeb0041cd2839e5954563a92.jpg'
    } else if (mention.content.match(/閉園[!！]*$/)) {
        await env.ochinchinland.put('status', 'close')
        content = 'https://cdn.nostr.build/i/4a7963a07bdac34b1408b871548d3a06527af359ad5a9f080d3c2031f6e582fe.jpg'
    } else if (mention.content.match(/開園[!！]*$/)) {
        await env.ochinchinland.put('status', 'open')
        content = 'https://cdn.nostr.build/i/662dab3ac355c5b2e8682f10eef4102342599bf8f77b52e9c7a7a52153398bfd.jpg'
    } else {
        return new Response('')
    }
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doWakaru(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const tags = mention.tags.filter((x: any[]) => x[0] === 'emoji')
    const content = mention.content.match(/^[わ分]かる[!！]*$/) ?
        'https://cdn.nostr.build/i/f795a1ba2802c5b397cb538d0068da2deb6e7510d8cfff877e5561a15d55199b.jpg' :
        'https://cdn.nostr.build/i/fd99d078ba96f85b5e3f754e1aeef5f42dbf3312b5a345c5f3ea6405ce2980a7.jpg'
    return new Response(JSON.stringify(createReplyWithTags(env, mention, content, tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

const hakatano = new Map([
    ['裸に', 'しろ'],
    ['はだかに', 'しろ'],
    ['たかなわ', 'ゲートウェイ'],
    ['たかだの', 'ばば'],
    ['さかたと', 'しお'],
    ['かけいと', 'しお'],
    ['もりもと', 'れお'],
    ['とみーず', 'まさ'],
    ['おかもと', 'まよ'],
    ['まつもと', 'いよ'],
    ['みわあき', 'ひろ'],
    ['あたたた', 'たた'],
    ['はやしら', 'いす'],
    ['あるかの', 'いど'],
    ['はがたを', 'みろ'],
    ['はかたの', 'しお'],
])

async function doHakatano(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const tags = mention.tags.filter((x: any[]) => x[0] === 'emoji')
    const content = mention.content.replace(/っ/g, '').replace(/[!！]/g, '').trim()
    for (const [k, v] of hakatano) {
        if (content === k) {
            return new Response(JSON.stringify(createReplyWithTags(env, mention, v, tags)), {
                headers: {
                    'content-type': 'application/json; charset=UTF-8',
                },
            })
        }
    }
    return new Response('')
}

async function doSUUMO(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    const content = '🌚ダン💥ダン💥ダン💥シャーン🎶ぽわ🌝ぽわ🌚ぽわ🌝ぽわ🌚ぽわ🌝ぽわ🌚ぽ〜〜〜わ⤴ぽわ🌚ぽわ🌝ぽわ🌚ぽわ🌝ぽわ🌚ぽわ🌝ぽ～～～わ⤵🌞'
    return new Response(JSON.stringify(createNoteWithTags(env, mention, content, [])), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doCAT(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    if (mention.pubkey === NULLPOGA_NPUB) return new Response('')
    let res = await fetch('https://api.thecatapi.com/v1/images/search')
    const images: { [name: string]: any } = await res.json()
    const tags = [['t', 'ぬっこ画像']]
    return new Response(JSON.stringify(createReplyWithTags(env, mention, `#ぬっこ画像\n${images[0].url}`, tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

async function doDOG(request: Request, env: Env): Promise<Response> {
    const mention: { [name: string]: any } = await request.json()
    if (mention.pubkey === NULLPOGA_NPUB) return new Response('')
    let res = await fetch('https://api.thedogapi.com/v1/images/search')
    const images: { [name: string]: any } = await res.json()
    const tags = [['t', 'いっぬ画像']]
    return new Response(JSON.stringify(createReplyWithTags(env, mention, `#いっぬ画像\n${images[0].url}`, tags)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    })
}

export default {
    async fetch(
        request: Request,
        env: Env): Promise<Response> {
        const { protocol, pathname } = new URL(request.url)

        if ('https:' !== protocol || 'https' !== request.headers.get('x-forwarded-proto')) {
            throw new Error('Please use a HTTPS connection.')
        }

        console.log(`${request.method}: ${request.url}`)

        if (request.method === 'GET') {
            switch (pathname) {
                case '/nullpo':
                    return doNullpo(request, env)
                case '/ochinchinland':
                    return doOchinchinLandStatus(request, env)
                case '/clock':
                    return doClock(request, env)
                case '/':
                    return doPage(request, env)
            }
            return notFound(request, env)
        }
        if (request.method === 'POST') {
            switch (pathname) {
                case '/loginbonus':
                    return doLoginbonus(request, env)
                case '/lokuyow':
                    return doLokuyow(request, env)
                case '/tsurupo':
                    return doTsurupoVa(request, env)
                case '/nagashite':
                    return doNagashite(request, env)
                case '/nattoruyarogai':
                    return doNattoruyarogai(request, env)
                case '/suddendeath':
                    return doSuddendeanth(request, env)
                case '/mahjongpai':
                    return doMahjongPai(request, env)
                case '/onlyyou':
                    return doOnlyYou(request, env)
                case '/suitou':
                    return doSuitou(request, env)
                case '/igyo':
                    return doIgyo(request, env)
                case '/letterpack':
                    return doLetterpack(request, env)
                case '/ultrasoul':
                    return doUltrasoul(request, env)
                case '/hi':
                    return doHi(request, env)
                case '/where':
                    return doWhere(request, env)
                case '/distance':
                    return doDistance(request, env)
                case '/like':
                    return doLike(request, env)
                case '/pe':
                    return doPe(request, env)
                case '/nya':
                    return doNya(request, env)
                case '/ochinchinland':
                    return doOchinchinLand(request, env)
                case '/wakaru':
                    return doWakaru(request, env)
                case '/hakatano':
                    return doHakatano(request, env)
                case '/suumo':
                    return doSUUMO(request, env)
                case '/cat':
                    return doCAT(request, env)
                case '/dog':
                    return doDOG(request, env)
                case '/':
                    return doNullpoGa(request, env)
            }
            return notFound(request, env)
        }

        return unsupportedMethod(request, env)
    },
}
