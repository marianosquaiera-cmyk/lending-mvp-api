import { Injectable } from '@nestjs/common';

@Injectable()
export class AfipService {
  async getInfo(cuit: string): Promise<any> {
    // Stub simple para MVP
    return {
      cuit,
      status: 'active',
      activity: 'Comercio Electrónico',
      inscriptionDate: '2020-01-15',
      deudaIVA: 0,
      apocrifo: false,
    };
  }
}
