# -*- coding: utf-8 -*-
"""阿里云云解析 DNS OpenAPI 小工具（RFC 风格 RPC 签名，仅用标准库）
用法:
  python3 aliyun_dns.py check
  python3 aliyun_dns.py set <RR> <TYPE> <VALUE> [TTL]
  python3 aliyun_dns.py add <RR> <TYPE> <VALUE> [TTL]
凭据文件默认 /tmp/aliyun-ram.txt，格式:
  accessKeyId LTAI...
  accessKeySecret ...
"""
import sys, os, json, time, uuid, hmac, hashlib, base64, urllib.parse, urllib.request
from datetime import datetime, timezone

DOMAIN = 'studentop.cn'
CRED_FILE = os.environ.get('ALI_CRED_FILE', '/tmp/aliyun-ram.txt')


def load_creds():
    kid = sec = None
    for line in open(CRED_FILE, encoding='utf-8', errors='ignore'):
        line = line.strip()
        if not line:
            continue
        parts = line.replace('=', ' ').split()
        if len(parts) < 2:
            continue
        k, v = parts[0].lower(), parts[1]
        if 'id' in k or 'keyid' in k:
            kid = v
        elif 'secret' in k:
            sec = v
    if not kid or not sec:
        raise SystemExit('无法从凭据文件解析 AccessKey')
    return kid, sec


def encode(s):
    return urllib.parse.quote(str(s), safe='~')


def call(action, **kw):
    kid, sec = load_creds()
    params = {
        'Action': action,
        'Version': '2015-01-09',
        'Format': 'JSON',
        'AccessKeyId': kid,
        'SignatureMethod': 'HMAC-SHA1',
        'SignatureVersion': '1.0',
        'SignatureNonce': str(uuid.uuid4()),
        'Timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    }
    params.update({k: v for k, v in kw.items() if v is not None})
    canonical = '&'.join('%s=%s' % (encode(k), encode(v)) for k, v in sorted(params.items()))
    string_to_sign = 'GET&%2F&' + encode(canonical)
    sig = base64.b64encode(hmac.new((sec + '&').encode('utf-8'), string_to_sign.encode('utf-8'), hashlib.sha1).digest()).decode()
    params['Signature'] = sig
    url = 'https://dns.aliyuncs.com/?' + '&'.join('%s=%s' % (encode(k), encode(v)) for k, v in sorted(params.items()))
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'win11home-dns/1.0'})
    with urllib.request.urlopen(req, timeout=25) as resp:
        return json.loads(resp.read().decode('utf-8'))


def show_records():
    data = call('DescribeDomainRecords', DomainName=DOMAIN, PageSize=100)
    recs = data.get('DomainRecords', {}).get('Record', [])
    if not recs:
        print('(当前没有任何解析记录)')
    for r in recs:
        print('%-28s %-6s %-40s TTL=%-5s status=%s id=%s' % (r.get('RR'), r.get('Type'), r.get('Value'), r.get('TTL'), r.get('Status'), r.get('RecordId')))
    return recs


def upsert(rr, typ, value, ttl='600'):
    recs = show_records()
    for r in recs:
        if r.get('RR') == rr and r.get('Type') == typ:
            call('UpdateDomainRecord', RecordId=r['RecordId'], RR=rr, Type=typ, Value=value, TTL=ttl)
            print('UPDATED', rr, typ, '->', value)
            return
    call('AddDomainRecord', DomainName=DOMAIN, RR=rr, Type=typ, Value=value, TTL=ttl)
    print('ADDED', rr, typ, '->', value)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    if cmd == 'check':
        show_records()
    elif cmd == 'add':
        call('AddDomainRecord', DomainName=DOMAIN, RR=sys.argv[2], Type=sys.argv[3], Value=sys.argv[4], TTL=sys.argv[5] if len(sys.argv) > 5 else '600')
        print('ADDED', sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == 'set':
        upsert(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else '600')
    else:
        print('用法: check | add RR TYPE VALUE [TTL] | set RR TYPE VALUE [TTL]')
