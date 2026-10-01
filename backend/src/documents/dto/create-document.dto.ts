import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** `POST /api/v1/documents` (`multipart/form-data`) — o arquivo vem via `@UploadedFile()`, fora deste DTO. */
export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsInt()
  documentTypeId: number;
}
