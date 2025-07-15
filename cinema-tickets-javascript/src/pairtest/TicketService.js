import TicketTypeRequest from './lib/TicketTypeRequest.js';
import InvalidPurchaseException from './lib/InvalidPurchaseException.js';

export default class TicketService {
  #ticketPrices = {
    ADULT: 25,
    CHILD: 15,
    INFANT: 0
  };

  #maxTicketsPerPurchase = 25;

  constructor(ticketPaymentService, seatReservationService) {
    this.ticketPaymentService = ticketPaymentService;
    this.seatReservationService = seatReservationService;
  }

  /**
   * Purchase tickets for a given account
   * @param {number} accountId - The account ID (must be > 0)
   * @param {...TicketTypeRequest} ticketTypeRequests - Variable number of ticket requests
   * @throws {InvalidPurchaseException} - If purchase is invalid
   */
  purchaseTickets(accountId, ...ticketTypeRequests) {
    this.validateTicketRequests(ticketTypeRequests);

    const ticketCounts = this.aggregateTicketCounts(ticketTypeRequests);
    
    this.validateBusinessRules(ticketCounts);

    const totalAmount = this.calculateTotalAmount(ticketCounts);
    const seatsToReserve = this.calculateSeatsToReserve(ticketCounts);

    // Make payment request
    this.ticketPaymentService.makePayment(accountId, totalAmount);

    // Make seat reservation request
    this.seatReservationService.reserveSeat(accountId, seatsToReserve);
  }

  validateTicketRequests(ticketTypeRequests) {
    if (!ticketTypeRequests || ticketTypeRequests.length === 0) {
      throw new InvalidPurchaseException('At least one ticket request is required');
    }

    // Validate each request is a TicketTypeRequest instance
    for (const request of ticketTypeRequests) {
      if (!(request instanceof TicketTypeRequest)) {
        throw new InvalidPurchaseException('All ticket requests must be TicketTypeRequest instances');
      }
    }
  }

  aggregateTicketCounts(ticketTypeRequests) {
    const counts = {
      ADULT: 0,
      CHILD: 0,
      INFANT: 0
    };

    for (const request of ticketTypeRequests) {
      const type = request.getTicketType();
      const quantity = request.getNoOfTickets();

      if (quantity <= 0) {
        throw new InvalidPurchaseException('Number of tickets must be greater than 0');
      }

      counts[type] += quantity;
    }

    return counts;
  }

  validateBusinessRules(ticketCounts) {
    const totalTickets = ticketCounts.ADULT + ticketCounts.CHILD + ticketCounts.INFANT;

    // Check maximum tickets limit
    if (totalTickets > this.#maxTicketsPerPurchase) {
      throw new InvalidPurchaseException(`Cannot purchase more than ${this.#maxTicketsPerPurchase} tickets at once`);
    }

    // Check that at least one adult ticket is purchased if child or infant tickets are requested
    if ((ticketCounts.CHILD > 0 || ticketCounts.INFANT > 0) && ticketCounts.ADULT === 0) {
      throw new InvalidPurchaseException('Child and Infant tickets cannot be purchased without Adult tickets');
    }

    // Check that there are enough adults for infants (infants sit on adult laps)
    if (ticketCounts.INFANT > ticketCounts.ADULT) {
      throw new InvalidPurchaseException('Number of Infant tickets cannot exceed number of Adult tickets');
    }
  }

  calculateTotalAmount(ticketCounts) {
    return (
      ticketCounts.ADULT * this.#ticketPrices.ADULT +
      ticketCounts.CHILD * this.#ticketPrices.CHILD +
      ticketCounts.INFANT * this.#ticketPrices.INFANT
    );
  }

  calculateSeatsToReserve(ticketCounts) {
    // Infants don't get seats (they sit on adult laps)
    return ticketCounts.ADULT + ticketCounts.CHILD;
  }
}
