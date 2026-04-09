import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Admin } from '../admins/entities/admin.entity.js';

@Entity('rules')
export class Rules {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'int' })
  version!: number;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;

  @ManyToOne(() => Admin)
  @JoinColumn()
  updatedBy!: Admin;
}
