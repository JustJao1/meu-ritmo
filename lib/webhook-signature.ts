export async function verifyWebhook(body: string, header: string, secret: string, now = Date.now()) { const parts = header.split(','), stamp = parts.find(p => p.startsWith('t='))?.slice(2); const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3)); if (!stamp || Math.abs(now / 1000 - Number(stamp)) > 300 || !signatures.length)
    return false; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']); for (const s of signatures) {
    if (!/^[0-9a-f]{64}$/i.test(s))
        continue;
    const bytes = Uint8Array.from(s.match(/../g)!, v => parseInt(v, 16));
    if (await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(stamp + '.' + body)))
        return true;
} return false; }
