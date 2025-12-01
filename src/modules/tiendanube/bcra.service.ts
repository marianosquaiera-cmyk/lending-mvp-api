import { Injectable } from '@nestjs/common';

@Injectable()
export class BcraService {
  async getInfo(cuit: string): Promise<any> {
    // Stub simple para MVP
    return {
      cuit,
      deudaTotal: 0,
      chequesRechazados: 0,
      situacionCrediticia: 'sin_deuda',
    };
  }
}
