import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AskSupportAssistantDto } from './dto/ask-support-assistant.dto';
import { SupportAssistantService } from './support-assistant.service';

@Controller('ai')
export class SupportAssistantController {
  constructor(private readonly supportAssistant: SupportAssistantService) {}

  @Post('support')
  @HttpCode(HttpStatus.OK)
  ask(@Body() input: AskSupportAssistantDto) {
    return this.supportAssistant.ask(input.question);
  }
}
