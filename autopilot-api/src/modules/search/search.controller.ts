import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import { SearchAskDto, SearchQueryDto } from './dto/search-query.dto';

interface JwtUser {
  sub: string;
}

@ApiTags('Search')
@Controller('api/v1/search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  query(@Query() dto: SearchQueryDto) {
    return this.search.query(dto.tenantId, dto.q);
  }

  @Post('ask')
  ask(@Req() req: { user: JwtUser }, @Body() dto: SearchAskDto) {
    return this.search.ask(dto.tenantId, String(req.user.sub), dto.q);
  }
}
