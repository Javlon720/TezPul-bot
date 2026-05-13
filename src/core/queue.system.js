
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MessageQueue {
  constructor(delayMs = 50) {
    this.delayMs = delayMs;
    this.queue = [];
    this.running = false;
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      if (!this.running) {
        this.run();
      }
    });
  }

  async run() {
    this.running = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      try {
        const result = await item.task();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
      if (this.delayMs > 0) {
        await delay(this.delayMs);
      }
    }
    this.running = false;
  }
}
