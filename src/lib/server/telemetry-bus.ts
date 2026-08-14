/**
 * Real-Time Telemetry Event Bus
 * Broadcasts live system events to SSE subscribers, web terminals, and CLI monitors.
 */

export interface TelemetryLogEvent {
	id: string;
	timestamp: string;
	level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'STREAM' | 'SEARCH' | 'INGEST';
	source: string;
	message: string;
	metadata?: Record<string, any>;
}

type EventListener = (event: TelemetryLogEvent) => void;

class TelemetryBus {
	private listeners: Set<EventListener> = new Set();
	private history: TelemetryLogEvent[] = [];
	private maxHistory = 100;

	constructor() {
		// Initialize with startup event
		this.emit({
			level: 'SUCCESS',
			source: 'CORE_ENGINE',
			message: 'Telemetry Event Bus initialized and listening.',
			metadata: { version: '2026.1', node: process.version }
		});
	}

	public subscribe(listener: EventListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	public getHistory(): TelemetryLogEvent[] {
		return [...this.history];
	}

	public emit(params: Omit<TelemetryLogEvent, 'id' | 'timestamp'>) {
		const event: TelemetryLogEvent = {
			id: crypto.randomUUID(),
			timestamp: new Date().toISOString(),
			...params
		};

		this.history.push(event);
		if (this.history.length > this.maxHistory) {
			this.history.shift();
		}

		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (err) {
				// Subscriber disconnected or errored
			}
		}
	}
}

export const telemetryBus = new TelemetryBus();
