ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS garage_public boolean NOT NULL DEFAULT true;

CREATE TABLE public.garage_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT 'Membro',
  brand text NOT NULL,
  model text NOT NULL,
  year integer,
  color text,
  description text NOT NULL DEFAULT '',
  photo_url text,
  video_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_cars TO authenticated;
GRANT ALL ON public.garage_cars TO service_role;
ALTER TABLE public.garage_cars ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.garage_hidden(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from public.profiles where id = _uid and garage_public = false)
$$;

CREATE POLICY "garage read" ON public.garage_cars FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR NOT public.garage_hidden(user_id));
CREATE POLICY "garage insert" ON public.garage_cars FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.member_level(auth.uid()) >= 1);
CREATE POLICY "garage update" ON public.garage_cars FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND public.member_level(auth.uid()) >= 1);
CREATE POLICY "garage delete" ON public.garage_cars FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER garage_author BEFORE INSERT ON public.garage_cars FOR EACH ROW EXECUTE FUNCTION public.fill_author();

CREATE POLICY "garage files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'garage');
CREATE POLICY "garage upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'garage' AND (storage.foldername(name))[1] = auth.uid()::text AND public.member_level(auth.uid()) >= 1);
CREATE POLICY "garage delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'garage' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER TABLE public.garage_cars DISABLE TRIGGER garage_author;
INSERT INTO public.garage_cars (user_id, author_name, brand, model, year, color, description, photo_url, video_url) VALUES
('00000000-0000-0000-0000-0000000000a1','Rafael Monteiro','Porsche','911 Carrera S',2022,'Branco','Meu companheiro de track day.','https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200','https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'),
('00000000-0000-0000-0000-0000000000a1','Rafael Monteiro','Ford','Mustang GT',2020,'Preto','V8 para os fins de semana.','https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200',NULL),
('00000000-0000-0000-0000-0000000000a2','Juliana Rocha','Ferrari','F8 Tributo',2021,'Vermelho','Realização de um sonho.','https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200','https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'),
('00000000-0000-0000-0000-0000000000a3','Carlos Almeida','Chevrolet','Corvette C8',2023,'Amarelo','Motor central, diversão garantida.','https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200',NULL);
ALTER TABLE public.garage_cars ENABLE TRIGGER garage_author;