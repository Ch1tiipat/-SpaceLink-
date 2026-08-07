import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';

/**
 * Public and deliberately unguarded, like EventsController. Product categories
 * are platform-wide reference data: not scoped to an organization, not
 * personal, and needed to render the shop form before a vendor has signed in.
 * See categories.controller.spec.ts, which asserts the absence of guards so a
 * later edit cannot add one without a decision.
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }
}
