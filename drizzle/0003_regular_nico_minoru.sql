CREATE INDEX "film_prices_countries_idx" ON "film_prices" USING gin ("countries");--> statement-breakpoint
CREATE INDEX "film_prices_film_id_idx" ON "film_prices" USING btree ("film_id");--> statement-breakpoint
CREATE INDEX "films_status_idx" ON "films" USING btree ("status");--> statement-breakpoint
CREATE INDEX "films_type_idx" ON "films" USING btree ("type");--> statement-breakpoint
CREATE INDEX "films_release_year_idx" ON "films" USING btree ("release_year");--> statement-breakpoint
CREATE INDEX "films_title_idx" ON "films" USING btree ("title");--> statement-breakpoint
CREATE INDEX "films_catalog_query_idx" ON "films" USING btree ("status","type","release_year");