/** Pure classification: absence of a response is not proof of physical offline. */
export function isNetworkFailure(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false;
  const error = cause as { name?: unknown; status?: unknown; message?: unknown; __isAuthError?: unknown };
  if (error.name === 'ApiError') return error.status === 0;
  if (error.name === 'AuthRetryableFetchError' && error.__isAuthError === true) {
    return error.status === 0;
  }
  return cause instanceof TypeError &&
    /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(cause.message);
}

export function isAuthorizationFailure(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') return false;
  const status = (cause as { status?: unknown }).status;
  return status === 401 || status === 403;
}

export function connectionMessage(online: boolean | undefined): string {
  return online === false
    ? 'ขณะนี้ออฟไลน์ ฟังก์ชันนี้ต้องใช้อินเทอร์เน็ต กรุณาเชื่อมต่อแล้วลองอีกครั้ง'
    : 'ยังเชื่อมต่อ SpaceLink API ไม่ได้ กรุณาลองอีกครั้ง';
}
