import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Volunteer } from '../../volunteers/volunteer.entity.js';
import { Campaign } from '../../campaigns/entities/campaign.entity.js';
import { SessionStatus } from '../../../common/constants/enums.js';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Volunteer)
  @JoinColumn()
  volunteer!: Volunteer;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE' })
  @JoinColumn()
  campaign!: Campaign;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.WAITING_ARRIVAL,
  })
  status!: SessionStatus;

  @Column({ type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endedAt!: Date | null;

  @Column({ type: 'int', nullable: true })
  durationSeconds!: number | null;

  @Column({ type: 'text', nullable: true })
  endReason!: string | null;

  @Column({ type: 'text', nullable: true })
  feedback!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  feedbackAt!: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lastLatitude!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lastLongitude!: number | null;

  @Column({ type: 'int', default: 0 })
  gpsCheckCount!: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
