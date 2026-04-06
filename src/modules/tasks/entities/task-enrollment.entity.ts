import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Volunteer } from '../../volunteers/volunteer.entity.js';
import { Task } from './task.entity.js';

@Entity('task_enrollments')
export class TaskEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Volunteer)
  @JoinColumn()
  volunteer!: Volunteer;

  @ManyToOne(() => Task, (task) => task.enrollments)
  @JoinColumn()
  task!: Task;

  @CreateDateColumn({ type: 'timestamp' })
  enrolledAt!: Date;

  @Column({ type: 'text', nullable: true })
  leaveReason!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  leftAt!: Date | null;
}
