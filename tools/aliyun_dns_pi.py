# -*- coding: utf-8 -*-
"""Aliyun DNS (RPC HMAC-SHA1) helper that reads creds from acme.sh account.conf."""
import sys, re, json, uuid, hmac, hashlib, base64, urllib.parse, urllib.request
from datetime import datetime, timezone

CONF = '/opt/acme.sh/config/account.conf'
DOMAIN = 'studentop.cn'

def load_creds():
    txt = open(CONF, encoding='utf-8', errors='ignore').read()
    kid = re.search(r"SAVED_Ali_Key='([^']+)'", txt) or re.search(r"SAVED_Ali_Key=(\S+)", txt)
    sec = re.search(r"SAVED_Ali_Secret='([^']+)'", txt) or re.search(r"SAVED_Ali_Secret=(\S+)", txt)
    if not kid or not sec:
        raise SystemExit('cannot parse creds')
    return kid.group(1), sec.group(1)

def enc(s):
    return urllib.parse.quote(str(s), safe='~')

def call(action, **kw):
    kid, sec = load_creds()
    p = {'Action': action, 'Version': '2015-01-09', 'Format': 'JSON',
         'AccessKeyId': kid, 'SignatureMethod': 'HMAC-SHA1', 'SignatureVersion': '1.0',
         'SignatureNonce': str(uuid.uuid4()),
         'Timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    p.update({k: v for k, v in kw.items() if v is not None})
    canonical = '&'.join('%s=%s' % (enc(k), enc(v)) for k, v in sorted(p.items()))
    sts = 'GET&%2F&' + enc(canonical)
    sig = base64.b64encode(hmac.new((sec + '&').encode(), sts.encode(), hashlib.sha1).digest()).decode()
    p['Signature'] = sig
    url = 'https://dns.aliyuncs.com/?' + '&'.join('%s=%s' % (enc(k), enc(v)) for k, v in sorted(p.items()))
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'pi-dns/1.0'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode())

def records():
    data = call('DescribeDomainRecords', DomainName=DOMAIN, PageSize=100)
    return data.get('DomainRecords', {}).get('Record', [])

def show():
    for r in records():
        print('%-8s %-6s %-38s TTL=%-4s status=%s id=%s' % (r.get('RR'), r.get('Type'), r.get('Value'), r.get('TTL'), r.get('Status'), r.get('RecordId')))

def upsert(rr, typ, value, ttl='600'):
    for r in records():
        if r.get('RR') == rr and r.get('Type') == typ:
            call('UpdateDomainRecord', RecordId=r['RecordId'], RR=rr, Type=typ, Value=value, TTL=ttl)
            print('UPDATED', rr, typ, '->', value); return
    call('AddDomainRecord', DomainName=DOMAIN, RR=rr, Type=typ, Value=value, TTL=ttl)
    print('ADDED', rr, typ, '->', value)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'
    if cmd == 'list':
        show()
    elif cmd == 'set':
        upsert(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else '600')
    else:
        print('usage: list | set RR TYPE VALUE [TTL]')
