import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reference data for the shop category picker. `description` and `icon` are
   * on the model but deliberately not selected — the picker needs neither, and
   * the shape here matches the `categories: [{ id, name }]` that ShopsService
   * and AuthController.me() already return.
   */
  findAll() {
    return this.prisma.productCategory.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }
}
