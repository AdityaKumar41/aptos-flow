import { aptosService } from './aptos.service.js';
import prisma from '../utils/prisma.js';

export class IndexerService {
  private isRunning: boolean = false;
  private pollIntervalMs: number = 10000; // 10 seconds

  /**
   * Start the event indexer
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Starting Indexer Service...');
    this.poll();
  }

  /**
   * Stop the event indexer
   */
  stop() {
    this.isRunning = false;
    console.log('Stopping Indexer Service...');
  }

  /**
   * Main polling loop
   */
  private async poll() {
    if (!this.isRunning) return;

    try {
      await this.checkEventTriggers();
    } catch (error) {
      console.error('Error in indexer poll loop:', error);
    }

    setTimeout(() => this.poll(), this.pollIntervalMs);
  }

  /**
   * Check for events that trigger workflows
   */
  private async checkEventTriggers() {
    // 1. Fetch active workflows with event triggers
    const workflows = await prisma.workflow.findMany({ 
      where: { 
        isActive: true, 
        triggerType: 'event' 
      } as any
    });
    
    for (const workflow of workflows) {
      try {
        // Parse trigger config
        const config = workflow.triggerConfig as any;
        if (!config || !config.address || !config.creationNumber) continue;

        const { address, creationNumber } = config;

        // 2. Fetch events from chain
        const events = await aptosService.getEvents(address, creationNumber);

        // 3. Check if new events match criteria
        if (events.length > 0) {
          // Check if event is new (store last processed sequence number in DB)
          // For MVP, we just log and trigger
          console.log(`Event detected for workflow ${workflow.id}`);
          
          // Trigger workflow
          await aptosService.executeWorkflow(workflow.id);
        }
      } catch (error) {
        console.error(`Error checking trigger for workflow ${workflow.id}:`, error);
      }
    }
  }
}

export const indexerService = new IndexerService();
