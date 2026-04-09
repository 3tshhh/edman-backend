import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Volunteer } from '../../volunteers/volunteer.entity.js';
import { Campaign } from './campaign.entity.js';

@Entity('campaign_enrollments')
export class CampaignEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Volunteer)
  @JoinColumn()
  volunteer!: Volunteer;

  @ManyToOne(() => Campaign, (campaign) => campaign.enrollments, { onDelete: 'CASCADE' })
  @JoinColumn()
  campaign!: Campaign;

  @CreateDateColumn({ type: 'timestamp' })
  enrolledAt!: Date;

  @Column({ type: 'text', nullable: true })
  leaveReason!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  leftAt!: Date | null;
}
