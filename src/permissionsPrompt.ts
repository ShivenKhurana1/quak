export type PermissionRequest = {
  tool: string;
  target?: string;
  reason: string;
};

export type PermissionResolver = (req: PermissionRequest) => Promise<boolean>;

let resolver: PermissionResolver | null = null;

export function setPermissionResolver(fn: PermissionResolver | null): void {
  resolver = fn;
}

export async function requestPermission(req: PermissionRequest): Promise<boolean> {
  if (!resolver) return false;
  return resolver(req);
}
