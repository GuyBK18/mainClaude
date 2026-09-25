import { LocalStorageRepository } from "./local-storage-repository";
import type { LibraryRepository } from "./repository";

export type { LibraryRepository, LibrarySnapshot } from "./repository";

let instance: LibraryRepository | null = null;

/** The single place that picks a data source. Replace the class here to move off LocalStorage. */
export function getRepository(): LibraryRepository {
  instance ??= new LocalStorageRepository();
  return instance;
}
