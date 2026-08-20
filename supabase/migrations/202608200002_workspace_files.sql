insert into storage.buckets (id, name, public, file_size_limit)
values ('workspace-files', 'workspace-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

create policy "members can read workspace files"
on storage.objects for select to authenticated
using (
  bucket_id = 'workspace-files'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

create policy "members can upload workspace files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'workspace-files'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);

create policy "members can delete workspace files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'workspace-files'
  and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
);
