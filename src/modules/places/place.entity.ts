import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VolunteerGroup } from '../../common/constants/enums.js';

@Entity('places')
export class Place {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude!: number;

  @Column({ type: 'enum', enum: VolunteerGroup })
  volunteerGroup!: VolunteerGroup;

  @Column({ type: 'varchar', length: 100, nullable: true })
  placeType!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photoKey!: string | null;

  @Column({ type: 'int', default: 300 })
  proximityThresholdMeters!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 1000 })
  addressLink!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
