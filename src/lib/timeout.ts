export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback?: T,
): Promise<T> {
  if (ms <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (fallback !== undefined) {
        resolve(fallback);
      } else {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
