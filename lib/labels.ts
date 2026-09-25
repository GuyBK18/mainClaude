import type { BookFormat, Genre, ReadingStatus } from "@/types/reading";

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  tbr: "To read",
  reading: "Reading",
  completed: "Finished",
  dnf: "Did not finish",
};

export const FORMAT_LABEL: Record<BookFormat, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  ebook: "Ebook",
  audiobook: "Audiobook",
};

export const GENRES: Genre[] = [
  "Literary Fiction",
  "Science Fiction",
  "Fantasy",
  "Mystery",
  "Historical Fiction",
  "Non-fiction",
  "Memoir",
  "Philosophy",
  "Poetry",
  "Essays",
];

export const STATUSES: ReadingStatus[] = ["reading", "tbr", "completed", "dnf"];
export const FORMATS: BookFormat[] = ["hardcover", "paperback", "ebook", "audiobook"];
