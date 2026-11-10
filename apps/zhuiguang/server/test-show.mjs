export async function createTestShow(base, pin, name = '浏览器验收') {
  const auth = await fetch(base + '/api/host', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
  });
  const cookie = auth.headers.get('set-cookie')?.split(';')[0];
  if (!auth.ok || !cookie) throw new Error('Test host authentication failed (HTTP ' + auth.status + ')');
  const response = await fetch(base + '/api/rooms', {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  const { show } = await response.json();
  if (!response.ok || !/^\d{6}$/.test(show?.id)) throw new Error('Could not create isolated test show');
  return { show, cookie };
}
