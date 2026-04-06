import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/user.entity.js';
import { VolunteerGroup } from '../../../common/constants/enums.js';

@Entity('sub_admins')
export class SubAdmin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { eager: true })
  @JoinColumn()
  user!: User;

  @Column({ type: 'enum', enum: VolunteerGroup })
  assignedGroup!: VolunteerGroup;
}
