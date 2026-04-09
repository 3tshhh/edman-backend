import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Session } from './session.entity.js';
import { Volunteer } from '../../volunteers/volunteer.entity.js';

@Entity('gps_audit_logs')
export class GpsAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn()
  session!: Session;

  @ManyToOne(() => Volunteer)
  @JoinColumn()
  volunteer!: Volunteer;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude!: number;

  @Column({ type: 'boolean' })
  isWithinRange!: boolean;

  @Column({ type: 'boolean', default: false })
  isFirstArrival!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
