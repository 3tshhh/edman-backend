import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user/user.entity.js';
import { Admin } from '../admins/entities/admin.entity.js';
import {
  ApplicationStatus,
  Area,
  EducationalLevel,
  Governorate,
  VolunteerGroup,
} from '../../common/constants/enums.js';

@Entity('volunteers')
export class Volunteer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { cascade: ['insert'], eager: true })
  @JoinColumn()
  user!: User;

  @Column({ type: 'varchar', length: 200 })
  fullName!: string;

  @Index()
  @Column({ type: 'varchar', length: 14, unique: true })
  nationalId!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  nationalIdPhotoKey!: string | null;

  @Column({ type: 'enum', enum: Governorate })
  governorate!: Governorate;

  @Column({ type: 'enum', enum: Area })
  area!: Area;

  @Column({ type: 'enum', enum: EducationalLevel })
  educationalLevel!: EducationalLevel;

  @Column({ type: 'boolean', default: false })
  hasCar!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profilePhoto!: string | null;

  @Column({ type: 'enum', enum: VolunteerGroup, nullable: true })
  volunteerGroup!: VolunteerGroup | null;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  applicationStatus!: ApplicationStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  appliedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt!: Date | null;

  @ManyToOne(() => Admin, { nullable: true })
  reviewedBy!: Admin | null;

  @Column({ type: 'int', default: 0 })
  rulesConfirmedVersion!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalVolunteeringHours!: number;
}
