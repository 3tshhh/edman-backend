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
import { User } from '../../user/user.entity.js';
import { TaskStatus, VolunteerGroup } from '../../../common/constants/enums.js';
import { TaskEnrollment } from './task-enrollment.entity.js';

@Entity('tasks')
export class Task {
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

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.OPEN })
  status!: TaskStatus;

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy!: User;

  @OneToMany(() => TaskEnrollment, (enrollment) => enrollment.task)
  enrollments!: TaskEnrollment[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
