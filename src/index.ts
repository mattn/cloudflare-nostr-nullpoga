'use strict';

import {
    nip19,
    getPublicKey,
    getEventHash,
    signEvent
} from 'nostr-tools'

export interface Env {
    NULLPOGA_TOKEN: string;
    NULLPOGA_NSEC: string;
}

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
    );
}

function unsupportedMethod(_request: Request, _env: Env) {
    return new Response(`Unsupported method`, {
        status: 400,
    });
}

function bearerAuthentication(request: Request, env: Env) {
    if (!request.headers.has('authorization')) {
        return false;
    }
    const authorization = request.headers.get('Authorization')!;
    const [scheme, encoded] = authorization.split(' ');
    return scheme === 'Bearer' && encoded === env.NULLPOGA_TOKEN;
}

function createEvent(env: Env, message: string): object {
    const decoded = nip19.decode(env.NULLPOGA_NSEC);
    const sk = decoded.data as string;
    const pk = getPublicKey(sk);
    let event = {
        id: '',
        kind: 1,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
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
    });
}

async function doNullpo(request: Request, env: Env): Promise<Response> {
    return new Response(JSON.stringify(createEvent(env, 'ぬるぽ')), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    });
}

async function doClock(request: Request, env: Env): Promise<Response> {
    const now = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
    const hour = now.getHours()
    const message = 'ぬるぽが' + (hour < 12 ? '午前' : '午後') + (hour % 12) + '時をお伝えします'
    return new Response(JSON.stringify(createEvent(env, message)), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    });
}

async function doGa(request: Request, env: Env): Promise<Response> {
    if (!bearerAuthentication(request, env)) {
        return notAuthenticated(request, env);
    }
    const mention: { [name: string]: string } = await request.json();
    if (!mention['content']?.match(/^(ぬる)+ぽ$/)) {
        return new Response('');
    }
    return new Response(JSON.stringify(createEvent(env, 'ｶﾞｯ'.repeat((mention['content'].length - 1) / 2))), {
        headers: {
            'content-type': 'application/json; charset=UTF-8',
        },
    });
}

export default {
    async fetch(
        request: Request,
        env: Env): Promise<Response> {
        const { protocol, pathname } = new URL(request.url);

        if ('https:' !== protocol || 'https' !== request.headers.get('x-forwarded-proto')) {
            throw new Error('Please use a HTTPS connection.')
        }

        console.log(`${request.method}: ${request.url}`);

        if (request.method === 'GET') {
            if (pathname == '/nullpo')
                return doNullpo(request, env);
            else if (pathname == '/clock')
                return doClock(request, env);
            else
                return doPage(request, env);
        }
        if (request.method === 'POST') {
            return doGa(request, env);
        }

        return unsupportedMethod(request, env);
    },
};
