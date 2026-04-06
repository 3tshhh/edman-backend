import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../common/constants/enums.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 20, unique: true })
  phone!: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  role!: UserRole | null;

  @Column({ type: 'boolean', default: false })
  isPhoneVerified!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fcmToken!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
