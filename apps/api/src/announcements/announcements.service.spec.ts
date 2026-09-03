import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

const findMany = jest.fn();
const findUnique = jest.fn();
const create = jest.fn();
const update = jest.fn();
const deleteAnnouncement = jest.fn();
const fanOutToOrganizationBookers = jest.fn();
const mockPrismaService = {
  announcement: {
    findMany,
    findUnique,
    create,
    update,
    delete: deleteAnnouncement,
  },
};
const mockNotificationsService = { fanOutToOrganizationBookers };

const organizationId = '00000000-0000-4000-8000-000000000001';
const announcementId = '00000000-0000-4000-8000-000000000002';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    fanOutToOrganizationBookers.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
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

  it('returns announcements across organizations with organization details', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.findAllAcrossOrganizations()).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('deletes an announcement across organizations with organization details', async () => {
    const announcement = {
      id: announcementId,
      organization: { id: organizationId, name: 'ตลาดทดสอบ' },
    };
    deleteAnnouncement.mockResolvedValue(announcement);

    await expect(
      service.removeAcrossOrganizations(announcementId),
    ).resolves.toEqual(announcement);
    expect(deleteAnnouncement).toHaveBeenCalledWith({
      where: { id: announcementId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });
  });

  it('creates an active announcement and notifies organization bookers', async () => {
    const dto: CreateAnnouncementDto = {
      title: 'แจ้งเปลี่ยนเวลาเปิดงาน',
      body: 'งานจะเปิดเวลา 10.00 น.',
    };
    create.mockResolvedValue({
      id: announcementId,
      ...dto,
      organizationId,
      isActive: true,
    });

    await service.create(organizationId, dto);

    expect(create).toHaveBeenCalledWith({
      data: { ...dto, organizationId },
    });
    expect(fanOutToOrganizationBookers).toHaveBeenCalledWith(organizationId, {
      type: NotificationType.ANNOUNCEMENT,
      title: dto.title,
      body: dto.body,
      relatedEntityType: 'ANNOUNCEMENT',
      relatedEntityId: announcementId,
    });
  });

  it('does not notify when an announcement is created inactive', async () => {
    const dto: CreateAnnouncementDto = {
      title: 'ร่างประกาศ',
      body: 'ยังไม่เผยแพร่',
      isActive: false,
    };
    create.mockResolvedValue({ id: announcementId, ...dto, organizationId });

    await service.create(organizationId, dto);

    expect(fanOutToOrganizationBookers).not.toHaveBeenCalled();
  });

  it('limits the notification body to two hundred characters', async () => {
    const body = 'x'.repeat(250);
    create.mockResolvedValue({
      id: announcementId,
      title: 'ประกาศสำคัญ',
      body,
      organizationId,
      isActive: true,
    });

    await service.create(organizationId, {
      title: 'ประกาศสำคัญ',
      body,
    });

    const [, notification] = fanOutToOrganizationBookers.mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(notification.body).toHaveLength(200);
    expect(notification.body.endsWith('…')).toBe(true);
  });

  it('scopes the update to the caller organization', async () => {
    const dto: UpdateAnnouncementDto = { isActive: false };
    findUnique.mockResolvedValue({ isActive: true });
    update.mockResolvedValue({
      id: announcementId,
      title: 'ประกาศ',
      body: 'รายละเอียด',
      isActive: false,
    });

    await service.update(announcementId, dto, organizationId);

    expect(update).toHaveBeenCalledWith({
      where: { id: announcementId, organizationId },
      data: dto,
    });
    expect(fanOutToOrganizationBookers).not.toHaveBeenCalled();
  });

  it('notifies only when an update activates an inactive announcement', async () => {
    findUnique.mockResolvedValue({ isActive: false });
    update.mockResolvedValue({
      id: announcementId,
      title: 'เปิดรับจองแล้ว',
      body: 'เลือกบูธได้ตั้งแต่วันนี้',
      isActive: true,
    });

    await service.update(announcementId, { isActive: true }, organizationId);

    expect(fanOutToOrganizationBookers).toHaveBeenCalledTimes(1);
    expect(fanOutToOrganizationBookers).toHaveBeenCalledWith(organizationId, {
      type: NotificationType.ANNOUNCEMENT,
      title: 'เปิดรับจองแล้ว',
      body: 'เลือกบูธได้ตั้งแต่วันนี้',
      relatedEntityType: 'ANNOUNCEMENT',
      relatedEntityId: announcementId,
    });
  });

  it('does not re-notify when editing an already-active announcement', async () => {
    findUnique.mockResolvedValue({ isActive: true });
    update.mockResolvedValue({
      id: announcementId,
      title: 'แก้คำผิด',
      body: 'รายละเอียดเดิม',
      isActive: true,
    });

    await service.update(announcementId, { title: 'แก้คำผิด' }, organizationId);

    expect(fanOutToOrganizationBookers).not.toHaveBeenCalled();
  });

  it('scopes the delete to the caller organization', async () => {
    deleteAnnouncement.mockResolvedValue({});

    await service.remove(announcementId, organizationId);

    expect(deleteAnnouncement).toHaveBeenCalledWith({
      where: { id: announcementId, organizationId },
    });
  });
});
