import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AbstractDto } from './dtos/abstract.dto';

export interface IAbstractEntity<DTO extends AbstractDto> {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class AbstractEntity<DTO extends AbstractDto = AbstractDto>
  implements IAbstractEntity<DTO>
{
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;
}
