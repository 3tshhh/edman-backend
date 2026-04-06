import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Session } from './session.entity.js';

@Entity('session_photos')
export class SessionPhoto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Session)
  @JoinColumn()
  session!: Session;

  @Column({ type: 'varchar', length: 500 })
  photoKey!: string;

  @CreateDateColumn({ type: 'timestamp' })
  takenAt!: Date;

  @Column({ type: 'int' })
  sequenceNo!: number;
}
