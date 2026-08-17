import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

const findMany = jest.fn();
const create = jest.fn();
const update = jest.fn();
const deleteAnnouncement = jest.fn();
const mockPrismaService = {
  announcement: {
    findMany,
    create,
    update,
    delete: deleteAnnouncement,
  },
};

const organizationId = '00000000-0000-4000-8000-000000000001';
const announcementId = '00000000-0000-4000-8000-000000000002';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnnouncementsService>(AnnouncementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns only active public announcements for the organization', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.findPublic(organizationId)).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId, isActive: true },
      orderBy: { publishedAt: 'desc' },
    });
  });

  it('returns every announcement for the organization to admins', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.findAllForAdmin(organizationId)).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('creates an announcement under the organization argument', async () => {
    const dto: CreateAnnouncementDto = {
      title: 'แจ้งเปลี่ยนเวลาเปิดงาน',
      body: 'งานจะเปิดเวลา 10.00 น.',
    };
    create.mockResolvedValue({ id: announcementId, ...dto, organizationId });

    await service.create(organizationId, dto);

    expect(create).toHaveBeenCalledWith({
      data: { ...dto, organizationId },
    });
  });

  it('scopes the update to the caller organization', async () => {
    const dto: UpdateAnnouncementDto = { isActive: false };
    update.mockResolvedValue({});

    await service.update(announcementId, dto, organizationId);

    expect(update).toHaveBeenCalledWith({
      where: { id: announcementId, organizationId },
      data: dto,
    });
  });

  it('scopes the delete to the caller organization', async () => {
    deleteAnnouncement.mockResolvedValue({});

    await service.remove(announcementId, organizationId);

    expect(deleteAnnouncement).toHaveBeenCalledWith({
      where: { id: announcementId, organizationId },
    });
  });
});
