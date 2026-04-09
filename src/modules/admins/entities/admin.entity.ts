import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('admins')
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  password!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Index()
  @Column({ type: 'varchar', length: 14, unique: true, nullable: true })
  nationalId!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
