import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../sessions/entities/session.entity.js';
import { GpsAuditLog } from '../sessions/entities/gps-audit-log.entity.js';
import { Volunteer } from '../volunteers/volunteer.entity.js';
import { SessionStatus, VolunteerGroup } from '../../common/constants/enums.js';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto.js';

export interface VolunteerPerformance {
  volunteerId: string;
  fullName: string;
  volunteerGroup: VolunteerGroup | null;
  totalVolunteeringHours: number;
  totalCompletedTasks: number;
  totalVisitedPlaces: number;
  consistencyScore: number | null;
  achievementScore: number | null;
  breakdown: {
    totalSessions: number;
    totalGpsPings: number;
    totalWithinRange: number;
    totalOutOfRange: number;
    gpsConfirmedTimePct: number;
  };
}

@Injectable()
export class PerformanceService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(GpsAuditLog)
    private readonly gpsAuditLogRepository: Repository<GpsAuditLog>,
    @InjectRepository(Volunteer)
    private readonly volunteerRepository: Repository<Volunteer>,
  ) {}

  async getMyPerformance(userId: string): Promise<VolunteerPerformance> {
    const volunteer = await this.volunteerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!volunteer) {
      throw new NotFoundException('لم يتم العثور على ملف المتطوع');
    }
    return this.computePerformance(volunteer);
  }

  async getVolunteerPerformance(
    volunteerId: string,
  ): Promise<VolunteerPerformance> {
    const volunteer = await this.volunteerRepository.findOne({
      where: { id: volunteerId },
    });
    if (!volunteer) {
      throw new NotFoundException('المتطوع غير موجود');
    }
    return this.computePerformance(volunteer);
  }

  async getLeaderboard(
    query: QueryLeaderboardDto,
  ): Promise<{ data: VolunteerPerformance[]; total: number }> {
    const qb = this.volunteerRepository.createQueryBuilder('volunteer');

    if (query.group) {
      qb.andWhere('volunteer.volunteerGroup = :group', {
        group: query.group,
      });
    }

    qb.andWhere('volunteer.applicationStatus = :status', {
      status: 'approved',
    });

    const [volunteers, total] = await qb.getManyAndCount();

    const performances = await Promise.all(
      volunteers.map((v) => this.computePerformance(v)),
    );

    const sortBy = query.sortBy ?? 'hours';
    const order = query.order ?? 'desc';

    performances.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortBy) {
        case 'tasks':
          aVal = a.totalCompletedTasks;
          bVal = b.totalCompletedTasks;
          break;
        case 'places':
          aVal = a.totalVisitedPlaces;
          bVal = b.totalVisitedPlaces;
          break;
        case 'consistency':
          aVal = a.consistencyScore ?? -1;
          bVal = b.consistencyScore ?? -1;
          break;
        case 'achievement':
          aVal = a.achievementScore ?? -1;
          bVal = b.achievementScore ?? -1;
          break;
        default:
          aVal = a.totalVolunteeringHours;
          bVal = b.totalVolunteeringHours;
      }

      return order === 'desc' ? bVal - aVal : aVal - bVal;
    });

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const paginated = performances.slice((page - 1) * limit, page * limit);

    return { data: paginated, total };
  }

  async getGroupStats(): Promise<object[]> {
    const groups = Object.values(VolunteerGroup);
    const results: object[] = [];

    for (const group of groups) {
      const volunteers = await this.volunteerRepository.find({
        where: { volunteerGroup: group, applicationStatus: 'approved' as any },
      });

      if (volunteers.length === 0) {
        results.push({
          group,
          volunteerCount: 0,
          avgHours: 0,
          avgConsistency: null,
          avgAchievement: null,
          topPerformers: [],
        });
        continue;
      }

      const performances = await Promise.all(
        volunteers.map((v) => this.computePerformance(v)),
      );

      const avgHours =
        performances.reduce((sum, p) => sum + p.totalVolunteeringHours, 0) /
        performances.length;

      const withConsistency = performances.filter(
        (p) => p.consistencyScore !== null,
      );
      const avgConsistency =
        withConsistency.length > 0
          ? withConsistency.reduce(
              (sum, p) => sum + (p.consistencyScore ?? 0),
              0,
            ) / withConsistency.length
          : null;

      const withAchievement = performances.filter(
        (p) => p.achievementScore !== null,
      );
      const avgAchievement =
        withAchievement.length > 0
          ? withAchievement.reduce(
              (sum, p) => sum + (p.achievementScore ?? 0),
              0,
            ) / withAchievement.length
          : null;

      const topPerformers = [...performances]
        .sort((a, b) => b.totalVolunteeringHours - a.totalVolunteeringHours)
        .slice(0, 3)
        .map((p) => ({
          volunteerId: p.volunteerId,
          fullName: p.fullName,
          totalVolunteeringHours: p.totalVolunteeringHours,
        }));

      results.push({
        group,
        volunteerCount: volunteers.length,
        avgHours: Math.round(avgHours * 100) / 100,
        avgConsistency:
          avgConsistency !== null
            ? Math.round(avgConsistency * 100) / 100
            : null,
        avgAchievement:
          avgAchievement !== null
            ? Math.round(avgAchievement * 100) / 100
            : null,
        topPerformers,
      });
    }

    return results;
  }

  private async computePerformance(
    volunteer: Volunteer,
  ): Promise<VolunteerPerformance> {
    // Completed sessions count
    const totalSessions = await this.sessionRepository.count({
      where: {
        volunteer: { id: volunteer.id },
        status: SessionStatus.COMPLETED,
      },
    });

    // Completed tasks count (unique tasks from completed sessions)
    const completedTasksResult = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.task', 'task')
      .where('session.volunteerId = :volunteerId', {
        volunteerId: volunteer.id,
      })
      .andWhere('session.status = :status', {
        status: SessionStatus.COMPLETED,
      })
      .select('COUNT(DISTINCT task.id)', 'count')
      .getRawOne();
    const totalCompletedTasks = Number(completedTasksResult?.count ?? 0);

    // Unique places visited
    const visitedPlacesResult = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoin('session.task', 'task')
      .where('session.volunteerId = :volunteerId', {
        volunteerId: volunteer.id,
      })
      .andWhere('session.status = :status', {
        status: SessionStatus.COMPLETED,
      })
      .select('COUNT(DISTINCT task.placeId)', 'count')
      .getRawOne();
    const totalVisitedPlaces = Number(visitedPlacesResult?.count ?? 0);

    // GPS audit log stats for completed sessions
    const gpsStats = await this.gpsAuditLogRepository
      .createQueryBuilder('log')
      .leftJoin('log.session', 'session')
      .where('log.volunteerId = :volunteerId', {
        volunteerId: volunteer.id,
      })
      .andWhere('session.status = :status', {
        status: SessionStatus.COMPLETED,
      })
      .select([
        'COUNT(*) as "totalPings"',
        'SUM(CASE WHEN log.isWithinRange = true THEN 1 ELSE 0 END) as "withinRange"',
      ])
      .getRawOne();

    const totalGpsPings = Number(gpsStats?.totalPings ?? 0);
    const totalWithinRange = Number(gpsStats?.withinRange ?? 0);
    const totalOutOfRange = totalGpsPings - totalWithinRange;

    // Consistency score
    let consistencyScore: number | null = null;
    if (totalGpsPings > 0) {
      consistencyScore =
        Math.round((totalWithinRange / totalGpsPings) * 100 * 100) / 100;
    }

    // Achievement score
    // GPS_CHECK_INTERVAL_SECONDS = 900 (15 min)
    let achievementScore: number | null = null;
    const totalDurationResult = await this.sessionRepository
      .createQueryBuilder('session')
      .where('session.volunteerId = :volunteerId', {
        volunteerId: volunteer.id,
      })
      .andWhere('session.status = :status', {
        status: SessionStatus.COMPLETED,
      })
      .select('COALESCE(SUM(session.durationSeconds), 0)', 'totalDuration')
      .getRawOne();
    const totalDuration = Number(totalDurationResult?.totalDuration ?? 0);

    if (totalDuration > 0 && totalWithinRange > 0) {
      const confirmedTime = totalWithinRange * 900;
      achievementScore = Math.min(
        Math.round((confirmedTime / totalDuration) * 100 * 100) / 100,
        100,
      );
    }

    const gpsConfirmedTimePct =
      totalDuration > 0 && totalWithinRange > 0
        ? Math.round(((totalWithinRange * 900) / totalDuration) * 100 * 100) /
          100
        : 0;

    return {
      volunteerId: volunteer.id,
      fullName: volunteer.fullName,
      volunteerGroup: volunteer.volunteerGroup,
      totalVolunteeringHours: Number(volunteer.totalVolunteeringHours),
      totalCompletedTasks,
      totalVisitedPlaces,
      consistencyScore,
      achievementScore,
      breakdown: {
        totalSessions,
        totalGpsPings,
        totalWithinRange,
        totalOutOfRange,
        gpsConfirmedTimePct,
      },
    };
  }
}
