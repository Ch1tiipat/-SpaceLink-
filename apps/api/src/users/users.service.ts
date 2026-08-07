import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { toUserResponse, type UserResponse } from './user-response';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO(SCRUM-24): implement Prisma create/update
  create(_createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  findAll() {
    return this.prisma.user.findMany();
  }

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
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
