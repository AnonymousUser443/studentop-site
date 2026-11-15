export class MusicFailure extends Error {
  constructor(code, message, status = 502, retryable = false) {
    super(message);
    this.name = "MusicFailure";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}
export function upstreamFailure(code) {
  const value = Number(code);
  if ([301, 302, 401].includes(value))
    return new MusicFailure(
      "login_expired",
      "网易云登录已失效，请重新扫码。",
      401,
    );
  if ([429, 509].includes(value))
    return new MusicFailure(
      "rate_limited",
      "请求有些频繁，稍等片刻再试。",
      429,
      true,
    );
  if ([403, 405, 406, 460, 461].includes(value))
    return new MusicFailure(
      "forbidden",
      "网易云暂时未允许这项操作，请稍后在官方客户端确认账号状态。",
      403,
    );
  if (value === 512)
    return new MusicFailure(
      "invalid_request",
      "歌曲已在歌单中，或歌单暂不接受这项操作。",
      409,
    );
  if (value === 404)
    return new MusicFailure("unavailable", "这项音乐内容暂不可用。", 404);
  return new MusicFailure(
    "upstream_error",
    "音乐服务暂时没有响应，请稍后重试。",
    502,
    true,
  );
}
/** SDK modules sometimes wrap another {status,body} inside body. HTTP 200 alone is never success. */
export function unwrap(result, allowedCodes = [200]) {
  let value = result;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw upstreamFailure();
    if (value.status !== undefined && Number(value.status) >= 400)
      throw upstreamFailure(value.body?.code ?? value.status);
    if (
      value.body &&
      typeof value.body === "object" &&
      !Array.isArray(value.body)
    ) {
      value = value.body;
      continue;
    }
    if (
      !Object.hasOwn(value, "code") ||
      !allowedCodes.includes(Number(value.code))
    )
      throw upstreamFailure(value.code);
    return value;
  }
  throw upstreamFailure();
}
export function safeFailure(error) {
  if (error instanceof MusicFailure) return error;
  return new MusicFailure(
    "upstream_error",
    "音乐服务暂时没有响应，请稍后重试。",
    502,
    true,
  );
}
