import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  async merchantLogin(email: string, password: string) {
    // MVP: devolver token dummy, el guard usa header x-merchant-id
    return {
      token: 'dummy-token',
      merchant: { email },
    };
  }

  async adminLogin(email: string, password: string) {
    return {
      token: 'dummy-admin-token',
      admin: { email },
    };
  }

  async getMerchantProfile(merchantId: string) {
    return { merchantId };
  }

  async getAdminProfile(adminId: string) {
    return { adminId };
  }
}