/**
 * WebSocket Reconnection Logic with Backoff
 * 
 * This utility provides automatic WebSocket reconnection
 * with exponential backoff to handle network issues gracefully.
 */

interface WebSocketReconnectOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  onConnecting?: () => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
}

class WebSocketReconnect {
  private ws: WebSocket | null = null;
  private url: string;
  private options: Required<WebSocketReconnectOptions>;
  private retryCount: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect: boolean = true;
  private manualClose: boolean = false;

  constructor(url: string, options: WebSocketReconnectOptions = {}) {
    this.url = url;
    this.options = {
      maxRetries: 10,
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      onConnecting: () => {},
      onConnected: () => {},
      onDisconnected: () => {},
      onError: () => {},
      ...options,
    };
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(): number {
    const delay = Math.min(
      this.options.initialDelay * Math.pow(this.options.backoffMultiplier, this.retryCount),
      this.options.maxDelay
    );
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return delay + jitter;
  }

  /**
   * Connect to WebSocket
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.shouldReconnect = true;
    this.manualClose = false;
    this.retryCount = 0;
    this.attemptConnection();
  }

  /**
   * Attempt to connect
   */
  private attemptConnection(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.options.onConnecting();

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.retryCount = 0;
        this.options.onConnected();
      };

      this.ws.onclose = (_event) => {
        this.options.onDisconnected();
        
        if (!this.manualClose && this.shouldReconnect && this.retryCount < this.options.maxRetries) {
          const delay = this.calculateDelay();
          this.retryCount++;
          // console.log(`WebSocket disconnected, retrying in ${Math.round(delay)}ms (attempt ${this.retryCount}/${this.options.maxRetries})`);
          
          this.reconnectTimeout = setTimeout(() => {
            this.attemptConnection();
          }, delay);
        }
      };

      this.ws.onerror = (error) => {
        this.options.onError(error);
      };

    } catch (error) {
      // console.error('WebSocket connection error:', error);
      this.options.onError(error as Event);
      
      if (!this.manualClose && this.shouldReconnect && this.retryCount < this.options.maxRetries) {
        const delay = this.calculateDelay();
        this.retryCount++;
        this.reconnectTimeout = setTimeout(() => {
          this.attemptConnection();
        }, delay);
      }
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.manualClose = true;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send data through WebSocket
   */
  send(data: string | object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      // console.warn('WebSocket is not connected, cannot send data');
    }
  }

  /**
   * Get current connection state
   */
  getState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'closed';
    }
  }

  /**
   * Set event handlers
   */
  on(event: 'message', handler: (data: any) => void): void;
  on(event: 'open', handler: () => void): void;
  on(event: 'close', handler: (event: CloseEvent) => void): void;
  on(event: 'error', handler: (error: Event) => void): void;
  on(event: string, handler: any): void {
    if (!this.ws) return;

    switch (event) {
      case 'message':
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handler(data);
          } catch {
            handler(event.data);
          }
        };
        break;
      case 'open':
        this.ws.onopen = () => handler();
        break;
      case 'close':
        this.ws.onclose = (event) => handler(event);
        break;
      case 'error':
        this.ws.onerror = (error) => handler(error);
        break;
    }
  }
}

export default WebSocketReconnect;
