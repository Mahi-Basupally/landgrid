insert into public.project_sections (project_id,name,sort_order,master_plan_url,drone_url)
select p.id,'Master',0,p.site_plan_url,p.drone_url
from public.projects p
where not exists (select 1 from public.project_sections s where s.project_id=p.id);
