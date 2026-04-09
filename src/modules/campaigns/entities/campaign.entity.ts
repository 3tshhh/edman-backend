import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Place } from '../../places/place.entity.js';
import { Admin } from '../../admins/entities/admin.entity.js';
import { CampaignStatus, VolunteerGroup } from '../../../common/constants/enums.js';
import { CampaignEnrollment } from './campaign-enrollment.entity.js';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @ManyToOne(() => Place, { eager: true })
  @JoinColumn()
  place!: Place;

  @Column({ type: 'enum', enum: VolunteerGroup })
  volunteerGroup!: VolunteerGroup;

  @Column({ type: 'date' })
  scheduledDate!: string;

  @Column({ type: 'time' })
  startTime!: string;

  @Column({ type: 'time' })
  endTime!: string;

  @Column({ type: 'int', default: 10 })
  maxVolunteers!: number;

  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.OPEN })
  status!: CampaignStatus;

  @ManyToOne(() => Admin)
  @JoinColumn()
  createdBy!: Admin;

  @OneToMany(() => CampaignEnrollment, (enrollment) => enrollment.campaign)
  enrollments!: CampaignEnrollment[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
