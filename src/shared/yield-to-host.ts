/** Resume on another host task so input and paint can run between slices. */
export function yieldToHost(): Promise<void> {
  if (typeof MessageChannel === "function") {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(undefined);
    });
  }
  return new Promise((resolve) => { window.setTimeout(resolve, 0); });
}
