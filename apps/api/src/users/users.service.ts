import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { toUserResponse, type UserResponse } from './user-response';

const userListSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isBlacklisted: true,
} satisfies Prisma.UserSelect;

export type UserListResponse = Prisma.UserGetPayload<{
  select: typeof userListSelect;
}>;

const userDetailSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  isBlacklisted: true,
  blacklistReason: true,
  createdAt: true,
  updatedAt: true,
  shops: {
    select: {
      id: true,
      name: true,
      description: true,
      logoUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
  bookingsPlaced: {
    select: {
      id: true,
      bookingCode: true,
      status: true,
      boothPrice: true,
      bookingStartDate: true,
      bookingEndDate: true,
      createdAt: true,
      event: { select: { id: true, name: true } },
      shop: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
  refundsRequested: {
    select: {
      id: true,
      reason: true,
      requestedAmount: true,
      approvedAmount: true,
      status: true,
      createdAt: true,
      booking: { select: { id: true, bookingCode: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
  penalties: {
    select: {
      id: true,
      reason: true,
      description: true,
      points: true,
      issuedAt: true,
      organization: { select: { id: true, name: true } },
    },
    orderBy: { issuedAt: 'desc' },
  },
  supportTickets: {
    select: {
      id: true,
      type: true,
      subject: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.UserSelect;

type UserDetailRecord = Prisma.UserGetPayload<{
  select: typeof userDetailSelect;
}>;

export type UserDetailResponse = Omit<
  UserDetailRecord,
  'bookingsPlaced' | 'refundsRequested'
> & {
  bookings: Array<
    Omit<UserDetailRecord['bookingsPlaced'][number], 'boothPrice'> & {
      boothPrice: string;
    }
  >;
  refunds: Array<
    Omit<
      UserDetailRecord['refundsRequested'][number],
      'requestedAmount' | 'approvedAmount'
    > & {
      requestedAmount: string;
      approvedAmount: string | null;
    }
  >;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO(SCRUM-24): implement Prisma create/update
  create(_createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  async findAll(): Promise<UserListResponse[]> {
    return this.prisma.user.findMany({
      select: userListSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<UserDetailResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userDetailSelect,
    });

    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    return this.toUserDetailResponse(user);
  }

  async getAuthUserId(id: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { authUserId: true },
    });

    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    return user.authUserId;
  }

  private toUserDetailResponse(user: UserDetailRecord): UserDetailResponse {
    const { bookingsPlaced, refundsRequested, ...rest } = user;

    return {
      ...rest,
      bookings: bookingsPlaced.map((booking) => ({
        ...booking,
        boothPrice: booking.boothPrice.toString(),
      })),
      refunds: refundsRequested.map((refund) => ({
        ...refund,
        requestedAmount: refund.requestedAmount.toString(),
        approvedAmount: refund.approvedAmount?.toString() ?? null,
      })),
    };
  }

  /**
   * `userId` is the authenticated user resolved by SupabaseAuthGuard, never a
   * client-supplied id (§14.2) — there is no id in the route at all.
   *
   * The row is known to exist because the guard provisions it (§7 step 4). If
   * it somehow does not, Prisma raises P2025 and PrismaExceptionFilter turns
   * that into a 404, which is the right answer anyway.
   */
  async updateMe(
    updateMeDto: UpdateMeDto,
    userId: string,
  ): Promise<UserResponse> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateMeDto,
    });

    return toUserResponse(user);
  }

  // TODO(SCRUM-24): implement Prisma create/update
  update(id: number, _updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
