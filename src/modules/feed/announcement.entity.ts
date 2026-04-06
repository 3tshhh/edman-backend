import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity.js';
import { VolunteerGroup } from '../../common/constants/enums.js';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { eager: true })
  author!: User;

  @Column({ type: 'enum', enum: VolunteerGroup, nullable: true })
  targetGroup!: VolunteerGroup | null;

  @Column({ type: 'varchar', length: 300 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'simple-array', nullable: true })
  attachments!: string[] | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  priority!: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
